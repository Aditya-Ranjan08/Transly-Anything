import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const tesseractLanguages = { en: 'eng', hi: 'hin', es: 'spa', fr: 'fra' };

function languageList(sourceLanguage) {
  if (sourceLanguage && sourceLanguage !== 'auto' && tesseractLanguages[sourceLanguage]) return [tesseractLanguages[sourceLanguage]];
  return (process.env.TESSERACT_AUTO_LANGUAGES || 'eng+hin+spa+fra').split(/[+,]/).map((language) => language.trim()).filter(Boolean);
}

async function prepareImage(filePathOrBuffer) {
  const input = await sharp(filePathOrBuffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();
  return input;
}

export async function createImageTextRecognizer(sourceLanguage = 'auto') {
  const worker = await createWorker(languageList(sourceLanguage));
  return {
    async recognize(filePathOrBuffer) {
      const input = await prepareImage(filePathOrBuffer);
      const { data } = await worker.recognize(input);
      const text = String(data?.text || '').trim();
      if (!text) throw new Error('No readable text was found in this image. Try a clearer image with larger text.');
      return text;
    },
    terminate: () => worker.terminate(),
  };
}

export async function recognizeImageText(filePathOrBuffer, sourceLanguage = 'auto') {
  const recognizer = await createImageTextRecognizer(sourceLanguage);
  try {
    return await recognizer.recognize(filePathOrBuffer);
  } finally {
    await recognizer.terminate();
  }
}
