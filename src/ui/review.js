/**
 * The review sheet.
 *
 * Non-negotiable step. OCR misreads digits, and this app stores numbers where a
 * wrong digit is worse than no answer — so every field is editable, removable
 * and addable before anything is committed, with the raw text kept underneath
 * for reference. The same sheet doubles as the editor for a saved document.
 */

import { addDoc, putDoc } from '../db.js';
import { CATEGORIES } from '../extract.js';
import { reload } from '../store.js';
import { $, el, clear, toast } from './dom.js';
import { openSheet, closeSheet, wireDismiss } from './sheets.js';
import { forgetThumb } from './rows.js';

/** The document being reviewed. Shape matches a stored document. */
let draft = null;

function renderFields() {
  const list = clear($('#flist'));

  if (!draft.fields.length) {
    list.append(el('div', { class: 'note', style: 'margin-bottom:14px' },
      'No fields were detected. Add the ones you want to be able to ask for.'));
  }

  draft.fields.forEach((field, i) => {
    const label = el('input', {
      class: 'fl', value: field.label, 'aria-label': `Field ${i + 1} label`,
      oninput: (e) => { draft.fields[i].label = e.target.value; },
    });
    const value = el('input', {
      class: 'fv', value: field.value, 'aria-label': `Field ${i + 1} value`,
      oninput: (e) => { draft.fields[i].value = e.target.value; },
    });
    const remove = el('button', {
      class: 'fx', type: 'button', text: '✕', 'aria-label': `Remove ${field.label}`,
      onclick: () => { draft.fields.splice(i, 1); renderFields(); },
    });
    list.append(el('div', { class: 'frow' }, label, value, remove));
  });
}

function renderType() {
  for (const button of $('#type-seg').children) {
    button.classList.toggle('on', button.dataset.t === draft.type);
  }
}

/**
 * @param {object} incoming draft document — {name, type, text, fields, fileBlob, thumbBlob, source}
 * @param {{mode?: 'new'|'edit', note?: string}} [options]
 */
export function open(incoming, { mode = 'new', note } = {}) {
  draft = { ...incoming, fields: incoming.fields.map((f) => ({ ...f })) };
  if (!CATEGORIES.includes(draft.type)) draft.type = 'Other';

  $('#rev-bd').querySelector('h2').textContent = mode === 'edit' ? 'Edit document' : 'Confirm details';
  $('#rev-sub').textContent = note
    || (mode === 'edit'
      ? 'Change anything here; the stored scan stays as it is.'
      : 'Fix anything that came out wrong, then save it.');
  $('#save').textContent = mode === 'edit' ? 'Save changes' : 'Save to pocketbook';
  $('#rev-name').value = draft.name || '';
  $('#raw').textContent = (draft.text || '').trim() || '(no text detected)';

  renderType();
  renderFields();
  openSheet('rev-bd');
}

function close() {
  draft = null;
  closeSheet('rev-bd');
}

async function save() {
  if (!draft) return;

  const name = $('#rev-name').value.trim();
  const fields = draft.fields
    .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.label && f.value);

  const record = {
    ...draft,
    name: name || 'Untitled document',
    fields,
    createdAt: draft.createdAt || Date.now(),
  };

  if (record.id != null) {
    await putDoc(record);
    forgetThumb(record.id);
  } else {
    await addDoc(record);
  }

  close();
  await reload();
  toast(record.id != null ? 'Changes saved.' : 'Saved to your pocketbook.');
}

export function init() {
  for (const button of $('#type-seg').children) {
    button.addEventListener('click', () => { draft.type = button.dataset.t; renderType(); });
  }
  $('#addf').addEventListener('click', () => {
    draft.fields.push({ label: '', value: '' });
    renderFields();
    $('#flist').lastElementChild?.querySelector('input')?.focus();
  });
  $('#discard').addEventListener('click', close);
  $('#save').addEventListener('click', save);
  wireDismiss('rev-bd', () => { draft = null; });
}
