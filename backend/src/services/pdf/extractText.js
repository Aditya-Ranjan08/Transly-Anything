import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { createImageTextRecognizer } from '../ocr/recognizeImage.js';

globalThis.DOMMatrix ||= DOMMatrix;
globalThis.ImageData ||= ImageData;
globalThis.Path2D ||= Path2D;

const maxPages = Math.max(1, Number(process.env.MAX_PDF_PAGES) || 40);
const imageOperations = new Set([
  pdfjs.OPS.paintImageXObject,
  pdfjs.OPS.paintInlineImageXObject,
  pdfjs.OPS.paintImageMaskXObject,
  pdfjs.OPS.paintImageXObjectRepeat,
]);

function pageTextFromItems(items) {
  const lines = [];
  let line = '';
  let previousY;
  for (const item of items) {
    if (typeof item.str !== 'string' || !item.str) continue;
    const y = item.transform?.[5];
    if (line && Number.isFinite(y) && Number.isFinite(previousY) && Math.abs(y - previousY) > 3) {
      lines.push(line.trim());
      line = '';
    }
    line += `${item.str}${item.hasEOL ? '\n' : ' '}`;
    if (Number.isFinite(y)) previousY = y;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function recognizeScannedPage(page, recognizer) {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1.65, 2400 / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return recognizer.recognize(canvas.toBuffer('image/png'));
}

export async function extractPdfPages(filePath, onPage = async () => {}, sourceLanguage = 'auto') {
  const data = await readFile(filePath);
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
  const document = await loadingTask.promise;
  let recognizer;
  try {
    if (document.numPages > maxPages) throw new Error(`This PDF has ${document.numPages} pages. The current limit is ${maxPages} pages.`);
    const pages = [];
    let textPageCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = pageTextFromItems(content.items);
      let hasImages = false;
      if (!text) {
        const operatorList = await page.getOperatorList();
        hasImages = operatorList.fnArray.some((operation) => imageOperations.has(operation));
        if (hasImages) {
          await onPage(pageNumber, document.numPages, 'OCR processing');
          recognizer ||= await createImageTextRecognizer(sourceLanguage);
          text = await recognizeScannedPage(page, recognizer);
        }
      }
      if (text) textPageCount += 1;
      pages.push({ pageNumber, text, hasImages });
      await onPage(pageNumber, document.numPages);
      page.cleanup();
    }
    if (!textPageCount) throw new Error('No readable text was found in this PDF. Check that the pages are clear and not blank.');
    return pages;
  } finally {
    if (recognizer) await recognizer.terminate().catch(() => {});
    await loadingTask.destroy();
  }
}
