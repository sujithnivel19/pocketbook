/**
 * OCR, entirely in-page.
 *
 * Tesseract, its WebAssembly core and the English traineddata are all vendored
 * under /vendor — the upstream library would otherwise pull them from a CDN at
 * first use, which would break the promise that nothing leaves the device.
 *
 * The engine is ~15 MB, so it is loaded lazily on the first scan and then cached
 * by the service worker. `warm()` lets Settings fetch it ahead of time.
 */

const BASE = new URL('../vendor/', import.meta.url);
const asset = (path) => new URL(path, BASE).href;

export const ENGINE_ASSETS = [
  asset('tesseract/worker.min.js'),
  asset('tessdata/eng.traineddata.gz'),
];

let workerPromise = null;

/** WebAssembly SIMD halves recognition time where it is available. */
function hasSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
      10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]));
  } catch {
    return false;
  }
}

export function corePath() {
  return asset(hasSimd()
    ? 'tesseract-core/tesseract-core-simd-lstm.wasm.js'
    : 'tesseract-core/tesseract-core-lstm.wasm.js');
}

async function getWorker(onStatus) {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    // The vendored ESM build wraps the CommonJS bundle, so the API hangs off
    // the default export rather than being named exports.
    const { default: Tesseract } = await import('../vendor/tesseract/tesseract.esm.min.js');
    return Tesseract.createWorker('eng', 1, {
      workerPath: asset('tesseract/worker.min.js'),
      langPath: asset('tessdata'),
      corePath: corePath(),
      workerBlobURL: false,
      gzip: true,
      logger: (m) => onStatus?.(m),
    });
  })().catch((err) => {
    workerPromise = null;
    throw err;
  });
  return workerPromise;
}

/**
 * @param {HTMLCanvasElement|Blob} image
 * @param {(stage: string, progress: number) => void} [onProgress]
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function read(image, onProgress) {
  const worker = await getWorker((m) => {
    if (m.status === 'recognizing text') onProgress?.('reading', m.progress);
    else onProgress?.(m.status, m.progress);
  });
  const { data } = await worker.recognize(image);
  return { text: data.text || '', confidence: data.confidence ?? 0 };
}

/** Pre-fetch the engine so the first scan isn't also a download. */
export async function warm(onProgress) {
  const total = ENGINE_ASSETS.length + 1;
  let done = 0;
  const tick = () => onProgress?.(++done / total);
  for (const url of [...ENGINE_ASSETS, corePath()]) {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`Could not fetch ${url.split('/').pop()}`);
    await res.arrayBuffer();
    tick();
  }
}

/** Free the worker's memory — the engine stays cached on disk. */
export async function release() {
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  workerPromise = null;
  await worker?.terminate?.();
}
