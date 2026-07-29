/**
 * Image preparation.
 *
 * Three sizes come out of one decode: a large bitmap for OCR (accuracy),
 * a moderate JPEG for storage (a phone photo is 4–8 MB; keeping it whole would
 * fill the origin's quota after a dozen documents), and a thumbnail for lists.
 */

const OCR_MAX = 2200;
const STORE_MAX = 1600;
const THUMB_MAX = 320;

async function decode(source) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(source); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('That file could not be read as an image.'));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function scaleTo(bitmap, max) {
  const w = bitmap.width || bitmap.naturalWidth;
  const h = bitmap.height || bitmap.naturalHeight;
  const ratio = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * ratio));
  canvas.height = Math.max(1, Math.round(h * ratio));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function toBlob(canvas, type = 'image/jpeg', quality = 0.82) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * @param {Blob} file
 * @returns {Promise<{ocr: HTMLCanvasElement, fileBlob: Blob, thumbBlob: Blob, width: number, height: number}>}
 */
export async function prepare(file) {
  const bitmap = await decode(file);
  const ocr = scaleTo(bitmap, OCR_MAX);
  const store = scaleTo(bitmap, STORE_MAX);
  const thumb = scaleTo(bitmap, THUMB_MAX);
  bitmap.close?.();
  const [fileBlob, thumbBlob] = await Promise.all([
    toBlob(store, 'image/jpeg', 0.82),
    toBlob(thumb, 'image/jpeg', 0.7),
  ]);
  return { ocr, fileBlob, thumbBlob, width: store.width, height: store.height };
}

/** Build storage + thumbnail blobs from a canvas that already exists (PDF pages). */
export async function fromCanvas(canvas) {
  const store = scaleTo(canvas, STORE_MAX);
  const thumb = scaleTo(canvas, THUMB_MAX);
  const [fileBlob, thumbBlob] = await Promise.all([
    toBlob(store, 'image/jpeg', 0.82),
    toBlob(thumb, 'image/jpeg', 0.7),
  ]);
  return { fileBlob, thumbBlob };
}
