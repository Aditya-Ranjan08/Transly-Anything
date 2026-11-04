import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import sharp from 'sharp';
import TranslationJob from '../models/TranslationJob.js';
import { getCapabilities, supportsPair } from '../services/translation/libreTranslate.js';
import { enqueueTranslation } from '../jobs/translationWorker.js';
import { sendDatabaseUnavailable } from '../utils/databaseErrors.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const storageRoot = path.resolve(moduleDirectory, '../../storage/tmp');
const tempExpiryHours = Math.max(1, Number(process.env.TEMP_FILE_TTL_HOURS) || 24);

function safeJob(job) {
  return {
    id: String(job._id || job.id),
    originalFileName: job.originalFileName,
    fileType: job.fileType,
    fileSize: job.fileSize,
    sourceLanguage: job.sourceLanguage,
    targetLanguage: job.targetLanguage,
    totalPages: job.totalPages,
    completedPages: job.completedPages,
    status: job.status,
    progress: job.progress,
    currentStage: job.currentStage,
    errorMessage: job.errorMessage,
    isFavorite: job.isFavorite,
    hasOriginal: Boolean(job.originalFilePath),
    hasOriginalText: Boolean(job.originalTextPath),
    hasTranslatedText: Boolean(job.translatedTextPath),
    hasTranslatedPdf: Boolean(job.translatedFilePath),
    expiresAt: job.expiresAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function ownedJob(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: 'This processing link is not valid.' });
    return null;
  }
  const job = await TranslationJob.findOne({ _id: id, userId: req.user.id });
  if (!job) {
    res.status(404).json({ message: 'We could not find this translation in your account.' });
    return null;
  }
  return job;
}

function safeOriginalName(value, fallback) {
  return path.basename(String(value || fallback)).replace(/[\x00-\x1f<>:"/\\?*|]/g, '_').slice(0, 180) || fallback;
}

function translatedPdfName(originalName) {
  return `Transly-${path.parse(originalName).name || 'translation'}.pdf`;
}

async function requireSupportedPair(sourceLanguage, targetLanguage, res) {
  if (!targetLanguage) {
    res.status(400).json({ message: 'Choose a target language.' });
    return false;
  }
  try {
    if (!await supportsPair(sourceLanguage, targetLanguage)) {
      res.status(400).json({ message: 'This language pair is not available from the configured translation providers.' });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ message: 'Translation providers are not reachable. Check their configuration and try again.' });
    return false;
  }
}

export async function getTranslationCapabilities(_req, res) {
  const capabilities = await getCapabilities();
  return res.json(capabilities);
}

export async function createTranslationJob(req, res) {
  const uploaded = req.file;
  if (!uploaded) return res.status(400).json({ message: 'Choose a PDF file first.' });
  let retained = false;

  try {
    const prefix = await fs.readFile(uploaded.path).then((buffer) => buffer.subarray(0, 1024).toString('latin1'));
    if (!prefix.includes('%PDF-')) return res.status(400).json({ message: 'This file does not appear to be a valid PDF.' });

    const sourceLanguage = String(req.body.sourceLanguage || 'auto').toLowerCase();
    const targetLanguage = String(req.body.targetLanguage || '').toLowerCase();
    if (!targetLanguage) return res.status(400).json({ message: 'Choose a target language.' });
    let supported;
    try { supported = await supportsPair(sourceLanguage, targetLanguage); }
    catch { return res.status(503).json({ message: 'Translation service is not reachable. Check its URL and try again.' }); }
    if (!supported) return res.status(400).json({ message: 'This language pair is not available from the configured translation service.' });

    const name = path.basename(uploaded.originalname).replace(/[\x00-\x1f<>:"/\\?*|]/g, '_').slice(0, 180) || 'document.pdf';
    const job = await TranslationJob.create({
      userId: req.user.id,
      originalFileName: name,
      originalFilePath: uploaded.path,
      fileType: 'pdf',
      fileSize: uploaded.size,
      sourceLanguage,
      targetLanguage,
      status: 'queued',
      currentStage: 'Queued',
      expiresAt: new Date(Date.now() + tempExpiryHours * 60 * 60 * 1000),
    });
    retained = true;
    enqueueTranslation(job.id);
    return res.status(202).json({ job: safeJob(job) });
  } catch (error) {
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: error.message?.includes('database') ? error.message : 'Could not start this translation job.' });
  } finally {
    if (req.file && !retained) await fs.rm(req.file.path, { force: true }).catch(() => {});
  }
}

export async function createImageTranslationJob(req, res) {
  const uploaded = req.file;
  if (!uploaded) return res.status(400).json({ message: 'Choose a PNG, JPG, or WebP image first.' });
  let retained = false;
  try {
    let metadata;
    try { metadata = await sharp(uploaded.path, { limitInputPixels: 40_000_000 }).metadata(); }
    catch { return res.status(400).json({ message: 'This image could not be read. Choose a valid PNG, JPG, or WebP image.' }); }
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      return res.status(400).json({ message: 'Choose a valid PNG, JPG, or WebP image.' });
    }
    const sourceLanguage = String(req.body.sourceLanguage || 'auto').toLowerCase();
    const targetLanguage = String(req.body.targetLanguage || '').toLowerCase();
    if (!await requireSupportedPair(sourceLanguage, targetLanguage, res)) return undefined;
    const name = safeOriginalName(uploaded.originalname, 'image');
    const job = await TranslationJob.create({
      userId: req.user.id,
      originalFileName: name,
      originalFilePath: uploaded.path,
      fileType: 'image',
      fileSize: uploaded.size,
      sourceLanguage,
      targetLanguage,
      totalPages: 1,
      status: 'queued',
      currentStage: 'Queued',
      expiresAt: new Date(Date.now() + tempExpiryHours * 60 * 60 * 1000),
    });
    retained = true;
    enqueueTranslation(job.id);
    return res.status(202).json({ job: safeJob(job) });
  } catch (error) {
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: 'Could not start image translation. Please try again.' });
  } finally {
    if (!retained) await fs.rm(uploaded.path, { force: true }).catch(() => {});
  }
}

export async function createTextTranslationJob(req, res) {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const maxCharacters = Math.min(100_000, Math.max(1000, Number(process.env.MAX_TEXT_CHARACTERS) || 50_000));
  if (!text) return res.status(400).json({ message: 'Enter some text to translate.' });
  if (text.length > maxCharacters) return res.status(413).json({ message: `Text must be ${maxCharacters.toLocaleString()} characters or fewer.` });

  const sourceLanguage = String(req.body.sourceLanguage || 'auto').toLowerCase();
  const targetLanguage = String(req.body.targetLanguage || '').toLowerCase();
  if (!await requireSupportedPair(sourceLanguage, targetLanguage, res)) return undefined;

  const id = new mongoose.Types.ObjectId();
  const originalTextPath = path.join(storageRoot, 'results', `${id}-original.txt`);
  await fs.mkdir(path.dirname(originalTextPath), { recursive: true });
  await fs.writeFile(originalTextPath, text, 'utf8');
  try {
    const job = await TranslationJob.create({
      _id: id,
      userId: req.user.id,
      originalFileName: safeOriginalName(req.body.title, 'Text translation'),
      originalTextPath,
      fileType: 'text',
      fileSize: Buffer.byteLength(text, 'utf8'),
      sourceLanguage,
      targetLanguage,
      totalPages: 1,
      status: 'queued',
      currentStage: 'Queued',
      expiresAt: new Date(Date.now() + tempExpiryHours * 60 * 60 * 1000),
    });
    enqueueTranslation(job.id);
    return res.status(202).json({ job: safeJob(job) });
  } catch (error) {
    await fs.rm(originalTextPath, { force: true }).catch(() => {});
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: 'Could not start this text translation. Please try again.' });
  }
}

export async function listTranslationJobs(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const filter = { userId: req.user.id };
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped, 'i');
    filter.$or = [
      { originalFileName: matcher },
      { sourceLanguage: matcher },
      { targetLanguage: matcher },
      { status: matcher },
    ];
  }
  const jobs = await TranslationJob.find(filter).sort({ createdAt: -1 }).limit(search ? 8 : 50).lean();
  const [total, completed, favorites, documents, images, texts] = await Promise.all([
    TranslationJob.countDocuments({ userId: req.user.id }),
    TranslationJob.countDocuments({ userId: req.user.id, status: 'completed' }),
    TranslationJob.countDocuments({ userId: req.user.id, isFavorite: true }),
    TranslationJob.countDocuments({ userId: req.user.id, fileType: 'pdf' }),
    TranslationJob.countDocuments({ userId: req.user.id, fileType: 'image' }),
    TranslationJob.countDocuments({ userId: req.user.id, fileType: 'text' }),
  ]);
  return res.json({ jobs: jobs.map(safeJob), stats: { total, completed, favorites, documents, images, texts } });
}

export async function getTranslationJob(req, res) {
  try {
    const job = await ownedJob(req, res);
    if (!job) return undefined;
    return res.json({ job: safeJob(job) });
  } catch (error) {
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: 'We could not load this translation job. Please try again.' });
  }
}

export async function getJobText(req, res) {
  try {
    const job = await ownedJob(req, res);
    if (!job) return undefined;
    const filePath = req.params.kind === 'original' ? job.originalTextPath : req.params.kind === 'translated' ? job.translatedTextPath : '';
    if (!filePath) return res.status(404).json({ message: 'Text preview is not available for this job yet.' });
    const text = await fs.readFile(filePath, 'utf8').catch(() => null);
    if (text === null) return res.status(410).json({ message: 'Temporary text files have expired. Submit the document again.' });
    return res.type('text/plain').send(text);
  } catch (error) {
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: 'We could not load this text preview.' });
  }
}

function storedPath(filePath) {
  if (!filePath) return '';
  const absolutePath = path.resolve(filePath);
  const relative = path.relative(storageRoot, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
  return absolutePath;
}

export async function streamJobFile(req, res) {
  try {
    const job = await ownedJob(req, res);
    if (!job) return undefined;
    const fileMap = {
      'original-pdf': { path: job.originalFilePath, name: job.originalFileName, type: 'application/pdf' },
      'translated-pdf': { path: job.translatedFilePath, name: translatedPdfName(job.originalFileName), type: 'application/pdf' },
      'original-image': {
        path: job.fileType === 'image' ? job.originalFilePath : '',
        name: job.originalFileName,
        type: ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(job.originalFileName).toLowerCase()] || 'application/octet-stream',
      },
      'original-text': { path: job.originalTextPath, name: `${job.originalFileName}.txt`, type: 'text/plain; charset=utf-8' },
      'translated-text': { path: job.translatedTextPath, name: `Transly-${job.originalFileName}.txt`, type: 'text/plain; charset=utf-8' },
    };
    const file = fileMap[req.params.kind];
    const absolutePath = file && storedPath(file.path);
    if (!absolutePath) return res.status(404).json({ message: 'This download is not available.' });
    const exists = await fs.access(absolutePath).then(() => true).catch(() => false);
    if (!exists) return res.status(410).json({ message: 'This temporary file has expired. Submit the document again.' });
    res.setHeader('Content-Type', file.type);
    if (req.query.inline === '1' && (file.type === 'application/pdf' || file.type.startsWith('image/'))) res.setHeader('Content-Disposition', 'inline');
    else res.attachment(file.name);
    return res.sendFile(absolutePath);
  } catch (error) {
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: 'We could not prepare this download.' });
  }
}

export async function cancelTranslationJob(req, res) {
  try {
    const job = await ownedJob(req, res);
    if (!job) return undefined;
    if (!['queued', 'processing'].includes(job.status)) return res.status(409).json({ message: 'This job can no longer be cancelled.' });
    job.status = 'cancelled';
    job.currentStage = 'Cancelled';
    job.errorMessage = '';
    await job.save();
    return res.json({ job: safeJob(job) });
  } catch (error) {
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: 'We could not cancel this job.' });
  }
}

export async function deleteTranslationJob(req, res) {
  try {
    const job = await ownedJob(req, res);
    if (!job) return undefined;

    const filePaths = [job.originalFilePath, job.originalTextPath, job.translatedTextPath, job.translatedFilePath]
      .map(storedPath)
      .filter(Boolean);
    if (['queued', 'processing'].includes(job.status)) {
      job.status = 'cancelled';
      job.currentStage = 'Cancelled';
      job.errorMessage = 'This job was deleted by the account owner.';
      await job.save();
    }
    await job.deleteOne();
    await Promise.all(filePaths.map((filePath) => fs.rm(filePath, { force: true }).catch(() => {})));
    return res.json({ message: 'Translation and its saved files were deleted.' });
  } catch (error) {
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: 'We could not delete this translation. Please try again.' });
  }
}

export async function setJobFavorite(req, res) {
  try {
    const job = await ownedJob(req, res);
    if (!job) return undefined;
    if (job.status !== 'completed') return res.status(409).json({ message: 'Only completed translations can be saved.' });
    job.isFavorite = req.body?.isFavorite === true;
    await job.save();
    return res.json({ job: safeJob(job) });
  } catch (error) {
    if (sendDatabaseUnavailable(res, error)) return undefined;
    return res.status(500).json({ message: 'We could not update this favorite.' });
  }
}
