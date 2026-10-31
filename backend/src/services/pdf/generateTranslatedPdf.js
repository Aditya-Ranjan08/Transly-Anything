import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

function devanagariFontPath() {
  if (process.env.PDF_FONT_PATH) {
    const configuredFont = path.resolve(moduleDirectory, '../../../', process.env.PDF_FONT_PATH);
    if (fs.existsSync(configuredFont)) return configuredFont;
  }
  if (process.platform === 'win32') {
    const windowsFont = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'Nirmala.ttc');
    if (fs.existsSync(windowsFont)) return windowsFont;
  }
  return '';
}

function usesDevanagari(pages) {
  return pages.some((page) => /\p{Script=Devanagari}/u.test(page.text));
}

function guardInvalidFontAnchors(document) {
  // Some Devanagari fonts contain empty GPOS anchors. fontkit currently
  // dereferences those anchors while positioning marks, which aborts PDF output.
  const gpos = document._font?.font?._layoutEngine?.engine?.GPOSProcessor;
  if (!gpos || gpos.__translySafeAnchors) return;
  const applyAnchor = gpos.applyAnchor;
  gpos.applyAnchor = function safeApplyAnchor(markRecord, baseAnchor, baseGlyphIndex) {
    if (!baseAnchor || !markRecord?.markAnchor) return;
    return applyAnchor.call(this, markRecord, baseAnchor, baseGlyphIndex);
  };
  gpos.__translySafeAnchors = true;
}

export async function generateTranslatedPdf(pages, outputPath, { originalFileName, sourceLanguage, targetLanguage }) {
  const needsDevanagari = usesDevanagari(pages);
  const fontPath = needsDevanagari ? devanagariFontPath() : '';
  if (needsDevanagari && !fontPath) {
    throw new Error('Hindi text was translated, but no Devanagari font is installed. Set PDF_FONT_PATH to a licensed .ttf or .otf font file.');
  }

  await new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 54, info: { Title: `Translated - ${originalFileName}`, Author: 'Transly' } });
    const output = fs.createWriteStream(outputPath);
    document.on('error', reject);
    output.on('error', reject);
    output.on('finish', resolve);
    document.pipe(output);
    if (fontPath && path.extname(fontPath).toLowerCase() === '.ttc') document.font(fontPath, 'NirmalaUI');
    else if (fontPath) document.font(fontPath);
    else document.font('Helvetica');
    if (needsDevanagari) guardInvalidFontAnchors(document);

    pages.forEach((page, index) => {
      if (index > 0) document.addPage();
      document.fillColor('#6b5a91').fontSize(9).text(`Transly - ${sourceLanguage.toUpperCase()} to ${targetLanguage.toUpperCase()} - Page ${index + 1}`, { align: 'right' });
      document.moveDown(1.2).fillColor('#211b2b').fontSize(11).text(page.text || ' ', { width: 486, lineGap: 4, paragraphGap: 7 });
    });
    document.end();
  });
}
