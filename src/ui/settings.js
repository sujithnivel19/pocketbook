/**
 * Settings: the lock, backups, the offline reader, and the honest small print.
 */

import { usage, clearDocs, clearRecents, metaDelete } from '../db.js';
import { exportAll, importAll, EXTENSION } from '../backup.js';
import * as ocr from '../ocr.js';
import { reload } from '../store.js';
import { forgetAllThumbs } from './rows.js';
import { $, el, clear, icon, toast, download, formatBytes } from './dom.js';
import { openSheet, closeSheet, wireDismiss, prompt, confirmAction } from './sheets.js';
import * as lock from './lock.js';

const VERSION = '1.0.0';

function row({ title, description, value, control, onClick }) {
  const node = el(onClick ? 'button' : 'div', {
    class: `set-row${onClick ? '' : ' static'}`,
    type: onClick ? 'button' : null,
    onclick: onClick,
  });
  node.append(el('div', { class: 'set-b' },
    el('div', { class: 'set-t', text: title }),
    description ? el('div', { class: 'set-d', text: description }) : null));
  if (value) node.append(el('span', { class: 'set-v', text: value }));
  if (control) node.append(control);
  if (onClick && !control && !value) node.append(el('span', { class: 'chev' }, icon('chevron')));
  return node;
}

function group(label, ...rows) {
  return el('div', { class: 'set-group' },
    el('div', { class: 'slabel', text: label }),
    ...rows.filter(Boolean));
}

function toggle(checked, onChange) {
  const node = el('button', {
    class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(checked),
    onclick: () => onChange(!checked),
  });
  return node;
}

/* ── Actions ── */

const digitsOnly = (v) => /^\d{4}$/.test(v);

async function enableLock() {
  const values = await prompt({
    title: 'Set a PIN',
    sub: 'Four digits. You will be asked for it when Pocketbook opens.',
    confirm: 'Set PIN',
    fields: [
      { label: 'New PIN', type: 'password', inputmode: 'numeric', maxlength: 4, placeholder: '••••' },
      { label: 'Confirm PIN', type: 'password', inputmode: 'numeric', maxlength: 4, placeholder: '••••' },
    ],
    note: 'The PIN locks the screen. It does not encrypt what is stored — someone with this unlocked phone and developer tools could still read the database.',
    validate: ([pin, again]) => {
      if (!digitsOnly(pin)) return 'The PIN must be exactly four digits.';
      if (pin !== again) return 'The two PINs do not match.';
      return null;
    },
  });
  if (!values) return;
  await lock.setPin(values[0]);
  render();
  toast('App lock is on.');
}

async function disableLock() {
  const values = await prompt({
    title: 'Turn off the lock?',
    sub: 'Enter your current PIN to confirm.',
    confirm: 'Turn off',
    tone: 'danger',
    fields: [{ label: 'Current PIN', type: 'password', inputmode: 'numeric', maxlength: 4, placeholder: '••••' }],
  });
  if (!values) return;
  if (!(await lock.verify(values[0]))) { toast('That PIN did not match.', 'bad'); return; }
  await lock.disable();
  render();
  toast('App lock is off.');
}

async function changePin() {
  const values = await prompt({
    title: 'Change PIN',
    confirm: 'Change',
    fields: [
      { label: 'Current PIN', type: 'password', inputmode: 'numeric', maxlength: 4, placeholder: '••••' },
      { label: 'New PIN', type: 'password', inputmode: 'numeric', maxlength: 4, placeholder: '••••' },
    ],
    validate: ([, next]) => (digitsOnly(next) ? null : 'The new PIN must be exactly four digits.'),
  });
  if (!values) return;
  if (!(await lock.verify(values[0]))) { toast('That PIN did not match.', 'bad'); return; }
  await lock.setPin(values[1]);
  toast('PIN changed.');
}

function cycleAutoLock() {
  const options = lock.AUTO_LOCK_OPTIONS;
  const i = options.findIndex((o) => o.ms === lock.autoLockMs());
  const next = options[(i + 1) % options.length];
  lock.setAutoLock(next.ms).then(render);
}

async function backup() {
  const values = await prompt({
    title: 'Back up your pocketbook',
    sub: 'The backup file is encrypted with a passphrase you choose.',
    confirm: 'Create backup',
    fields: [
      { label: 'Passphrase', type: 'password', placeholder: 'at least 8 characters' },
      { label: 'Confirm passphrase', type: 'password', placeholder: 'again' },
    ],
    note: 'There is no way to recover this passphrase. Without it the backup cannot be opened — not by you, and not by us.',
    validate: ([pass, again]) => {
      if (pass.length < 8) return 'Use at least eight characters.';
      if (pass !== again) return 'The two passphrases do not match.';
      return null;
    },
  });
  if (!values) return;

  try {
    toast('Encrypting…');
    const { blob, filename, count } = await exportAll(values[0]);
    download(blob, filename);
    toast(`${count} document${count === 1 ? '' : 's'} backed up.`);
  } catch (err) {
    toast(err.message, 'bad');
  }
}

function restore() {
  $('#restore-in').click();
}

async function handleRestoreFile(file) {
  const values = await prompt({
    title: 'Restore from backup',
    sub: `Opening ${file.name}.`,
    confirm: 'Restore',
    fields: [{ label: 'Passphrase', type: 'password', placeholder: 'the passphrase you chose' }],
    note: 'Restoring adds to what is already here. Documents already in your pocketbook are skipped.',
  });
  if (!values) return;

  try {
    toast('Decrypting…');
    const { added, skipped } = await importAll(file, values[0]);
    await reload();
    render();
    toast(added
      ? `Restored ${added} document${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already here` : ''}.`
      : 'Everything in that backup is already here.');
  } catch (err) {
    toast(err.message, 'bad');
  }
}

async function downloadReader() {
  try {
    toast('Downloading the text reader…');
    await ocr.warm();
    toast('The reader is stored on this device. Scanning now works offline.');
  } catch (err) {
    toast(err.message || 'The reader could not be downloaded.', 'bad');
  }
}

async function eraseEverything() {
  const ok = await confirmAction({
    title: 'Erase everything?',
    sub: 'Every document, scan and setting on this device will be removed.',
    confirm: 'Erase everything',
    note: 'This cannot be undone. If you have not made a backup, the documents are gone.',
  });
  if (!ok) return;
  await clearDocs();
  await clearRecents();
  await metaDelete('visits');
  await lock.disable();
  forgetAllThumbs();
  await reload();
  render();
  toast('Everything has been erased.');
}

/* ── Render ── */

async function render() {
  const body = clear($('#set-body'));
  const bytes = await usage();
  const auto = lock.AUTO_LOCK_OPTIONS.find((o) => o.ms === lock.autoLockMs()) || lock.AUTO_LOCK_OPTIONS[0];

  body.append(group('Security',
    row({
      title: 'App lock',
      description: 'Ask for a PIN when Pocketbook opens.',
      control: toggle(lock.isEnabled(), (on) => (on ? enableLock() : disableLock())),
    }),
    lock.isEnabled() && row({ title: 'Change PIN', onClick: changePin }),
    lock.isEnabled() && row({
      title: 'Lock when I leave',
      description: 'How long the app stays open after you switch away.',
      value: auto.label,
      onClick: cycleAutoLock,
    }),
    el('div', { class: 'note' },
      el('b', { text: 'What the lock does. ' }),
      'It covers the screen. It does not encrypt the database, so someone with this unlocked phone and developer tools could still read it.')));

  body.append(group('Backup',
    row({
      title: 'Back up',
      description: `One encrypted ${EXTENSION} file you keep yourself.`,
      onClick: backup,
    }),
    row({ title: 'Restore from backup', description: 'Adds to what is already here.', onClick: restore }),
    el('div', { class: 'note warn' },
      el('b', { text: 'Nothing syncs. ' }),
      'Lose this device or clear the browser’s data and the vault is gone with it. A backup is the only copy.')));

  body.append(group('Offline',
    row({
      title: 'Download the text reader',
      description: 'About 15 MB. Fetched on the first scan otherwise.',
      onClick: downloadReader,
    }),
    row({ title: 'Storage used', description: 'Documents and scans on this device.', value: formatBytes(bytes) })));

  body.append(group('Danger',
    row({ title: 'Erase everything', description: 'Remove all documents and settings.', onClick: eraseEverything })));

  body.append(group('About',
    row({ title: 'Pocketbook', description: 'Local-first document vault.', value: `v${VERSION}` }),
    el('div', { class: 'note' },
      'Text is read on this device and stored on this device. Pocketbook makes no network request after the page loads — there is no server and no account.')));
}

export function open() {
  render();
  openSheet('set-bd');
}

export function init() {
  $('#settings-btn').addEventListener('click', open);
  $('#set-close').addEventListener('click', () => closeSheet('set-bd'));
  wireDismiss('set-bd');
  $('#restore-in').addEventListener('change', async (e) => {
    const [file] = e.target.files;
    e.target.value = '';
    if (file) await handleRestoreFile(file);
  });
}
