/**
 * The detail sheet: everything stored about one document, with copy on every
 * field — the same job the answer card does, reached by browsing instead of asking.
 */

import { deleteDoc } from '../db.js';
import { reload } from '../store.js';
import {
  $, el, clear, icon, copyButton, urlBag, formatDate, download, toast,
} from './dom.js';
import { openSheet, closeSheet, wireDismiss, confirmAction } from './sheets.js';
import { forgetThumb } from './rows.js';
import { open as openReview } from './review.js';

const bag = urlBag();
let current = null;

function preview(doc) {
  const wrap = clear($('#d-preview'));
  if (!doc.fileBlob) return;

  const thumb = el('div', { class: 'thumb' },
    el('img', { src: bag.for(doc.fileBlob), alt: `Scan of ${doc.name}`, loading: 'lazy' }));
  const dl = el('button', {
    class: 'dl-overlay', type: 'button', 'aria-label': `Download ${doc.name}`,
    onclick: () => {
      const ext = (doc.fileBlob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      download(doc.fileBlob, `${doc.name.replace(/\.[^.]+$/, '')}.${ext}`);
      toast('Saved to your device — outside the vault.');
    },
  });
  dl.append(icon('download', { 'stroke-width': 2 }));
  thumb.append(dl);
  wrap.append(el('div', { class: 'srcdoc', style: 'margin: 0 0 6px' }, thumb));
}

export function open(doc) {
  current = doc;
  bag.release();

  $('#d-title').textContent = doc.name;
  $('#d-sub').textContent = `${doc.type} · added ${formatDate(doc.createdAt)}`;
  preview(doc);

  const fields = clear($('#d-fields'));
  if (!doc.fields.length) {
    fields.append(el('div', { class: 'empty' }, 'No fields were saved for this one.'));
  }
  for (const f of doc.fields) {
    fields.append(el('div', { class: 'dfield' },
      el('span', { class: 'dl', text: f.label }),
      el('span', { class: 'dv', text: f.value }),
      copyButton(f.value, f.label, { small: true })));
  }

  openSheet('det-bd');
}

function close() {
  bag.release();
  current = null;
  closeSheet('det-bd');
}

export function init() {
  $('#d-close').addEventListener('click', close);
  $('#d-edit').addEventListener('click', () => {
    const doc = current;
    close();
    if (doc) openReview(doc, { mode: 'edit' });
  });
  $('#d-del').addEventListener('click', async () => {
    if (!current) return;
    const doc = current;
    const ok = await confirmAction({
      title: 'Delete this document?',
      sub: `“${doc.name}” and everything read from it will be removed from this device.`,
      confirm: 'Delete',
      note: 'There is no undo, and no copy anywhere else unless you have made a backup.',
    });
    if (!ok) return;
    await deleteDoc(doc.id);
    forgetThumb(doc.id);
    close();
    await reload();
    toast('Document deleted.');
  });
  wireDismiss('det-bd', () => { bag.release(); current = null; });
}
