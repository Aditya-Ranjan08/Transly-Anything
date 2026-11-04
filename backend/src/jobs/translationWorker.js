import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import TranslationJob from '../models/TranslationJob.js';
import { translateText } from '../services/translation/libreTranslate.js';
import { extractPdfPages } from '../services/pdf/extractText.js';
import { generateTranslatedPdf } from '../services/pdf/generateTranslatedPdf.js';
import { recognizeImageText } from '../services/ocr/recognizeImage.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const storageRoot = path.resolve(moduleDirectory, '../../storage/tmp');
const uploadDirectory = path.join(storageRoot, 'uploads');
const resultDirectory = path.join(storageRoot, 'results');
const maxCharacters = Math.max(250, Number(process.env.TRANSLATION_CHUNK_SIZE) || 3500);
const expiryHours = Math.max(1, Number(process.env.TEMP_FILE_TTL_HOURS) || 24);
const queue = [];
const queuedIds = new Set();
let draining = false;
let cleanupTimer = null;
let retryTimer = null;
const interruptedJobIds = new Set();

function splitIntoChunks(text) {
  const chunks = [];
  let remainder = text.trim();
  while (remainder.length > maxCharacters) {
    let cut = remainder.lastIndexOf('\n', maxCharacters);
    if (cut < maxCharacters * 0.55) cut = remainder.lastIndexOf(' ', maxCharacters);
    if (cut < maxCharacters * 0.55) cut = maxCharacters;
    chunks.push(remainder.slice(0, cut).trim());
    remainder = remainder.slice(cut).trim();
  }
  if (remainder) chunks.push(remainder);
  return chunks;
}

function scheduleDatabaseRecoveryRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    if (mongoose.connection.readyState !== 1) {
      scheduleDatabaseRecoveryRetry();
      return;
    }
    const interruptedIds = [...interruptedJobIds];
    for (const jobId of interruptedIds) {
      try {
        await updateActiveJob(jobId, {
          status: 'failed',
          currentStage: 'Failed',
          errorMessage: 'A database interruption stopped this translation. Please try again.',
          expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        });
        interruptedJobIds.delete(jobId);
      } catch {
        scheduleDatabaseRecoveryRetry();
        return;
      }
    }
    void drainQueue().catch((error) => console.error(`Translation queue recovery failed (${error.name || 'unknown'}).`));
  }, 5000);
  retryTimer.unref?.();
}

async function updateActiveJob(jobId, fields) {
  return TranslationJob.updateOne({ _id: jobId, status: { $in: ['queued', 'processing'] } }, { $set: fields });
}

async function wasCancelled(jobId) {
  const job = await TranslationJob.findById(jobId).select('status').lean();
  return !job || job.status === 'cancelled';
}

async function persistText(filePath, pages) {
  const text = pages.map((page, index) => `--- Page ${index + 1} ---\n${page.text || ''}`).join('\n\n');
  await fs.writeFile(filePath, text, 'utf8');
}

async function processJob(jobId) {
  let job = await TranslationJob.findById(jobId);
  if (!job || job.status === 'cancelled') return;
  let activeStage = 'Extracting text';
  const originalTextPath = path.join(resultDirectory, `${jobId}-original.txt`);
  const translatedTextPath = path.join(resultDirectory, `${jobId}-translated.txt`);
  const translatedPdfPath = path.join(resultDirectory, `${jobId}-translated.pdf`);

  try {
    await updateActiveJob(jobId, { status: 'processing', currentStage: job.fileType === 'image' ? 'Recognizing image text' : 'Extracting text', progress: 1, errorMessage: '' });
    let originalPages;
    if (job.fileType === 'pdf') {
      originalPages = await extractPdfPages(job.originalFilePath, async (completed, total, stage) => {
        activeStage = stage || 'Extracting text';
        await updateActiveJob(jobId, {
          currentStage: activeStage,
          totalPages: total,
          completedPages: 0,
          progress: stage === 'OCR processing' ? Math.max(2, Math.round((completed - 1) / total * 8) + 1) : Math.max(1, Math.round(completed / total * 8)),
        });
      }, job.sourceLanguage);
    } else if (job.fileType === 'image') {
      const text = await recognizeImageText(job.originalFilePath, job.sourceLanguage);
      originalPages = [{ pageNumber: 1, text }];
      await updateActiveJob(jobId, { currentStage: 'Recognized image text', totalPages: 1, progress: 8 });
    } else if (job.fileType === 'text') {
      const text = await fs.readFile(job.originalTextPath, 'utf8');
      if (!text.trim()) throw new Error('Enter some text to translate.');
      originalPages = [{ pageNumber: 1, text }];
      await updateActiveJob(jobId, { currentStage: 'Text ready', totalPages: 1, progress: 8 });
    } else {
      throw new Error('This translation input type is not supported.');
    }
    if (await wasCancelled(jobId)) return;

    await fs.mkdir(resultDirectory, { recursive: true });
    await persistText(originalTextPath, originalPages);
    const pageChunks = originalPages.map((page) => splitIntoChunks(page.text));
    const totalChunks = pageChunks.reduce((sum, chunks) => sum + chunks.length, 0);
    if (!totalChunks) throw new Error('No translatable text was found in this PDF.');

    activeStage = 'Translating';
    await updateActiveJob(jobId, { currentStage: activeStage, progress: 10, completedPages: 0 });
    let finishedChunks = 0;
    let completedPages = 0;
    const translatedPages = [];
    for (let pageIndex = 0; pageIndex < originalPages.length; pageIndex += 1) {
      const translatedChunks = [];
      for (const chunk of pageChunks[pageIndex]) {
        if (await wasCancelled(jobId)) return;
        const result = await translateText(chunk, job.sourceLanguage, job.targetLanguage);
        translatedChunks.push(result);
        finishedChunks += 1;
        await updateActiveJob(jobId, {
          currentStage: 'Translating',
          completedPages,
          progress: 10 + Math.floor(finishedChunks / totalChunks * 64),
        });
      }
      translatedPages.push({ pageNumber: originalPages[pageIndex].pageNumber, text: translatedChunks.join('\n\n') });
      completedPages += 1;
      await updateActiveJob(jobId, { completedPages, progress: 10 + Math.floor(finishedChunks / totalChunks * 64) });
    }
    if (await wasCancelled(jobId)) return;

    await persistText(translatedTextPath, translatedPages);
    activeStage = 'Generating PDF';
    await updateActiveJob(jobId, { currentStage: activeStage, progress: 78, originalTextPath, translatedTextPath });
    await generateTranslatedPdf(translatedPages, translatedPdfPath, {
      originalFileName: job.originalFileName,
      sourceLanguage: job.sourceLanguage,
      targetLanguage: job.targetLanguage,
    });
    if (await wasCancelled(jobId)) {
      await fs.rm(translatedPdfPath, { force: true });
      return;
    }

    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    await updateActiveJob(jobId, {
      status: 'completed',
      currentStage: 'Completed',
      progress: 100,
      completedPages: originalPages.length,
      originalTextPath,
      translatedTextPath,
      translatedFilePath: translatedPdfPath,
      expiresAt,
      errorMessage: '',
    });
  } catch (error) {
    if (await wasCancelled(jobId).catch(() => false)) return;
    const safeMessage = error.status === 429
      ? 'The translation service rate limit was reached. Try again later.'
      : error.message?.slice(0, 500) || 'This document could not be processed.';
    await updateActiveJob(jobId, {
      status: 'failed',
      currentStage: activeStage,
      errorMessage: safeMessage,
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
    });
    await fs.rm(translatedPdfPath, { force: true }).catch(() => {});
  }
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const jobId = queue.shift();
      let retryAfterReconnect = false;
      try {
        await processJob(jobId);
      } catch (error) {
        console.error(`Translation worker could not process job ${jobId} (${error.name || 'unknown'}).`);
        if (mongoose.connection.readyState !== 1) {
          interruptedJobIds.add(jobId);
          retryAfterReconnect = true;
        } else {
          await updateActiveJob(jobId, {
            status: 'failed',
            currentStage: 'Failed',
            errorMessage: 'A temporary server error interrupted this translation. Please try again.',
            expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
          }).catch((updateError) => console.error(`Could not save failure state for job ${jobId} (${updateError.name || 'unknown'}).`));
        }
      } finally {
        queuedIds.delete(jobId);
      }
      if (retryAfterReconnect) {
        scheduleDatabaseRecoveryRetry();
        break;
      }
    }
  } finally {
    draining = false;
  }
}

export function enqueueTranslation(jobId) {
  const id = String(jobId);
  if (queuedIds.has(id)) return;
  queuedIds.add(id);
  queue.push(id);
  void drainQueue().catch((error) => console.error(`Translation queue failed (${error.name || 'unknown'}).`));
}

export async function recoverTranslationJobs() {
  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.mkdir(resultDirectory, { recursive: true });
  await TranslationJob.updateMany(
    { status: 'processing' },
    { $set: { status: 'failed', currentStage: 'Failed', errorMessage: 'The server restarted before this job finished. Submit the document again.', expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000) } },
  );
  const queued = await TranslationJob.find({ status: 'queued' }).select('_id').lean();
  queued.forEach(({ _id }) => enqueueTranslation(_id));
  await cleanupExpiredFiles();
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      void cleanupExpiredFiles().catch((error) => console.error(`Expired-file cleanup failed (${error.name || 'unknown'}).`));
    }, 60 * 60 * 1000);
    cleanupTimer.unref?.();
  }
}

export async function cleanupExpiredFiles() {
  const expired = await TranslationJob.find({ expiresAt: { $lte: new Date() } })
    .select('originalFilePath originalTextPath translatedTextPath translatedFilePath expiresAt')
    .lean();
  await Promise.all(expired.flatMap((job) => [job.originalFilePath, job.originalTextPath, job.translatedTextPath, job.translatedFilePath]
    .filter(Boolean).map((filePath) => fs.rm(filePath, { force: true }).catch(() => {}))));
}
