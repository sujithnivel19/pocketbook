/**
 * Bottom sheets: open/close plumbing plus the one reusable sheet used for
 * confirmations and for anything the app needs to ask for (a PIN, a passphrase).
 */

import { $, el, clear } from './dom.js';

const openSheets = [];

export function openSheet(backdropId) {
  const backdrop = $(`#${backdropId}`);
  backdrop.classList.add('show');
  if (!openSheets.includes(backdropId)) openSheets.push(backdropId);
  backdrop.querySelector('.sheet').scrollTop = 0;
  return backdrop;
}

export function closeSheet(backdropId) {
  $(`#${backdropId}`).classList.remove('show');
  const i = openSheets.indexOf(backdropId);
  if (i >= 0) openSheets.splice(i, 1);
}

export const isSheetOpen = () => openSheets.length > 0;
export const topSheet = () => openSheets[openSheets.length - 1];

/** Tapping the dimmed area closes the sheet above it. */
export function wireDismiss(backdropId, onClose) {
  const backdrop = $(`#${backdropId}`);
  backdrop.addEventListener('click', (e) => {
    if (e.target !== backdrop) return;
    closeSheet(backdropId);
    onClose?.();
  });
}

/**
 * The app's single prompt sheet. Replaces window.confirm/prompt, which look
 * foreign on a phone and cannot be styled.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.sub]
 * @param {string} [options.confirm] primary button label
 * @param {'default'|'danger'} [options.tone]
 * @param {{label: string, type?: string, placeholder?: string, inputmode?: string,
 *          maxlength?: number, note?: string}[]} [options.fields]
 * @param {(values: string[]) => string|null} [options.validate] returns an error message, or null
 * @returns {Promise<string[]|null>} field values, or null if dismissed
 */
export function prompt({
  title, sub = '', confirm = 'Continue', tone = 'default', fields = [], note = null, validate,
}) {
  const backdrop = $('#ask-bd');
  const body = clear($('#ask-body'));
  const ok = $('#ask-ok');
  const cancel = $('#ask-cancel');

  $('#ask-title').textContent = title;
  $('#ask-sub').textContent = sub;
  $('#ask-sub').hidden = !sub;
  ok.textContent = confirm;
  ok.className = tone === 'danger' ? 'btn d' : 'btn p';

  const inputs = fields.map((f) => {
    const input = el('input', {
      class: 'pin-input',
      type: f.type || 'text',
      placeholder: f.placeholder || '',
      inputmode: f.inputmode || 'text',
      maxlength: f.maxlength || 64,
      autocomplete: 'off',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
      'aria-label': f.label,
    });
    body.append(el('div', { class: 'set-d', style: 'margin-bottom:8px' }, f.label), input);
    if (f.note) body.append(el('div', { class: 'note', style: 'margin-bottom:14px' }, f.note));
    return input;
  });

  const error = el('div', { class: 'field-err' });
  body.append(error);
  if (note) body.append(el('div', { class: 'note warn' }, note));

  openSheet('ask-bd');
  setTimeout(() => inputs[0]?.focus(), 260);

  return new Promise((resolve) => {
    const finish = (value) => {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      backdrop.removeEventListener('click', onBackdrop);
      body.removeEventListener('keydown', onKey);
      closeSheet('ask-bd');
      resolve(value);
    };
    const onOk = () => {
      const values = inputs.map((i) => i.value);
      const message = validate?.(values);
      if (message) { error.textContent = message; return; }
      finish(values);
    };
    const onCancel = () => finish(null);
    const onBackdrop = (e) => { if (e.target === backdrop) finish(null); };
    const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); onOk(); } };

    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    backdrop.addEventListener('click', onBackdrop);
    body.addEventListener('keydown', onKey);
  });
}

/** Yes/no with no input. Resolves true when the primary button is pressed. */
export async function confirmAction({ title, sub, confirm = 'Confirm', tone = 'danger', note }) {
  return (await prompt({ title, sub, confirm, tone, note, fields: [] })) !== null;
}
