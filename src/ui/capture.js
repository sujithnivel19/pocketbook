/**
 * Capture: camera, image upload (including PDFs).
 *
 * Everything funnels into the same place — text out, fields proposed, review
 * sheet opened. Nothing is written to the vault from here; only the review
 * sheet saves.
 */

import { extract, guessType, suggestName } from '../extract.js';
import { prepare } from '../images.js';
import * as ocr from '../ocr.js';
import * as pdf from '../pdf.js';
import { $, toast } from './dom.js';
import { open as openReview } from './review.js';

let dialOpen = false;

function setStatus(text, sub = '') {
  $('#scan-s').textContent = text;
  $('#scan-sub').textContent = sub;
}

function showOverlay(on) {
  $('#scan').classList.toggle('show', on);
  if (!on) setStatus('Reading document…');
}

const percent = (p) => `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%`;

/** First scan also downloads the ~15 MB engine; say so rather than seeming stuck. */
function ocrProgress(prefix = 'Reading document') {
  let announcedDownload = false;
  return (stage, progress) => {
    if (stage === 'reading') {
      setStatus(`${prefix}… ${percent(progress)}`);
    } else if (stage) {
      if (!announcedDownload && /core|language|traineddata|initial/i.test(stage)) {
        announcedDownload = true;
        setStatus('Preparing the reader…', 'First run only — the text reader is being unpacked on this device.');
      } else {
        setStatus(`${stage}…`);
      }
    }
  };
}

async function handleImage(file) {
  setStatus('Preparing image…');
  const { ocr: canvas, fileBlob, thumbBlob } = await prepare(file);
  const { text } = await ocr.read(canvas, ocrProgress());
  return { text, fileBlob, thumbBlob, source: 'image' };
}

async function handlePdf(file) {
  setStatus('Opening PDF…');
  const result = await pdf.read(file, (stage, progress) => {
    if (stage === 'text') setStatus(`Reading PDF… ${percent(progress)}`);
    if (stage === 'render') setStatus(`Rendering pages… ${percent(progress)}`);
  });

  let { text } = result;
  if (result.needsOcr) {
    // No text layer: a scan saved as a PDF. Rasterise and OCR each page.
    const parts = [];
    for (let i = 0; i < result.pages.length; i += 1) {
      const label = result.pages.length > 1 ? `Reading page ${i + 1} of ${result.pages.length}` : 'Reading document';
      const { text: pageText } = await ocr.read(result.pages[i], ocrProgress(label));
      parts.push(pageText);
    }
    text = parts.join('\n');
  }

  return {
    text,
    fileBlob: result.fileBlob,
    thumbBlob: result.thumbBlob,
    source: result.needsOcr ? 'pdf-scan' : 'pdf-text',
    pageCount: result.pageCount,
  };
}

async function process(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  showOverlay(true);
  try {
    const result = isPdf ? await handlePdf(file) : await handleImage(file);
    const fields = extract(result.text);
    const type = guessType(fields);
    const fallbackName = file.name.replace(/\.[^.]+$/, '') || 'Document';

    showOverlay(false);
    openReview({
      name: suggestName(fields, type, fallbackName),
      type,
      text: result.text,
      fields,
      fileBlob: result.fileBlob,
      thumbBlob: result.thumbBlob,
      source: result.source,
      createdAt: Date.now(),
    }, {
      note: result.source === 'pdf-text'
        ? 'Read straight from the PDF’s own text, so these should be accurate.'
        : undefined,
    });
  } catch (err) {
    showOverlay(false);
    console.error(err);
    toast(err.message || 'That file could not be read.', 'bad');
  }
}

/* ── Speed dial ── */

export function setDial(open) {
  dialOpen = open;
  $('#dial').classList.toggle('open', open);
  $('#dial-scrim').classList.toggle('open', open);
  $('#fab').classList.toggle('open', open);
  $('#fab').setAttribute('aria-expanded', String(open));
}

export const isDialOpen = () => dialOpen;

export function init() {
  $('#fab').addEventListener('click', () => setDial(!dialOpen));
  $('#dial-scrim').addEventListener('click', () => setDial(false));

  const pick = (id) => { setDial(false); $(`#${id}`).click(); };
  $('#cam-btn').addEventListener('click', () => pick('cam-in'));
  $('#gal-btn').addEventListener('click', () => pick('file-in'));

  for (const id of ['cam-in', 'file-in']) {
    $(`#${id}`).addEventListener('change', async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      for (const file of files) await process(file);
    });
  }
}
