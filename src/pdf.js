/**
 * PDF ingestion.
 *
 * Most documents arrive as a PDF first — bank statements, bills, certificates,
 * e-Aadhaar. Where a PDF carries a text layer we read it directly and skip OCR
 * entirely, which is both faster and more accurate than photographing the page.
 * Scanned PDFs have no text layer, so those pages get rasterised and sent to OCR.
 */

import { fromCanvas } from './images.js';

const MAX_PAGES = 12;
const RASTER_SCALE = 2.0;
/** Below this much text, assume the "text layer" is just a stray label. */
const TEXT_LAYER_MIN_CHARS = 60;

let pdfjs = null;

async function lib() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
}

/**
 * Rebuild lines from pdf.js text items.
 *
 * Items already carry their own spacing, and a letter-spaced run arrives as one
 * item per glyph — joining on a space would turn `BQRPS4821K` into `B Q R P S…`
 * and no pattern would ever match it. So items are concatenated as they come and
 * broken only where the PDF says the line ends.
 */
function joinItems(items) {
  let out = '';
  for (const item of items) {
    out += item.str;
    if (item.hasEOL) out += '\n';
  }
  return out;
}

function renderTo(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return page.render({ canvasContext: ctx, viewport }).promise.then(() => canvas);
}

/**
 * @param {File|Blob} file
 * @param {(stage: string, progress: number) => void} [onProgress]
 * @returns {Promise<{text: string, pageCount: number, needsOcr: boolean,
 *                    pages: HTMLCanvasElement[], fileBlob: Blob, thumbBlob: Blob}>}
 */
export async function read(file, onProgress) {
  const { getDocument } = await lib();
  const buffer = await file.arrayBuffer();
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const totalPages = doc.numPages;
  const pageCount = Math.min(totalPages, MAX_PAGES);

  let text = '';
  for (let n = 1; n <= pageCount; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    text += `${joinItems(content.items)}\n`;
    onProgress?.('text', n / pageCount);
  }

  const needsOcr = text.replace(/\s/g, '').length < TEXT_LAYER_MIN_CHARS;

  // The first page always becomes the stored preview; further pages are only
  // rasterised when there is no text layer and OCR has to do the work.
  const pages = [];
  const rasterCount = needsOcr ? pageCount : 1;
  for (let n = 1; n <= rasterCount; n += 1) {
    pages.push(await renderTo(await doc.getPage(n), RASTER_SCALE));
    onProgress?.('render', n / rasterCount);
  }

  const { fileBlob, thumbBlob } = await fromCanvas(pages[0]);
  await doc.destroy();

  return { text: needsOcr ? '' : text, pageCount: totalPages, needsOcr, pages, fileBlob, thumbBlob };
}
