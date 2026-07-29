/**
 * App lock.
 *
 * An unprotected store of ID numbers is the largest security gap in a local-only
 * app: anyone holding an unlocked phone has the vault. A PIN closes the obvious
 * hole — someone picking the phone up.
 *
 * Be clear about what it is not: this gates the interface, it does not encrypt
 * what is on disk. A determined person with the unlocked device and developer
 * tools can still read IndexedDB directly. Settings says so in as many words.
 */

import { metaGet, metaSet, metaDelete } from '../db.js';
import { derivePinDigest, digestsMatch, randomBytes, toBase64, fromBase64, PIN_ITERATIONS } from '../crypto.js';
import { $, el, clear } from './dom.js';

const KEY = 'lock';
const PIN_LENGTH = 4;

export const AUTO_LOCK_OPTIONS = [
  { ms: 0, label: 'Immediately' },
  { ms: 60_000, label: 'After 1 min' },
  { ms: 300_000, label: 'After 5 min' },
  { ms: 900_000, label: 'After 15 min' },
];

let config = null;
let entry = '';
let unlockResolve = null;
let hiddenAt = 0;

export async function load() {
  config = await metaGet(KEY, null);
  return config;
}

export const isEnabled = () => Boolean(config);
export const autoLockMs = () => config?.autoLockMs ?? 0;
export const isLocked = () => $('#lock').classList.contains('show');

export async function setPin(pin) {
  const salt = randomBytes(16);
  config = {
    salt: toBase64(salt),
    iterations: PIN_ITERATIONS,
    digest: await derivePinDigest(pin, salt, PIN_ITERATIONS),
    autoLockMs: config?.autoLockMs ?? 0,
  };
  await metaSet(KEY, config);
}

export async function verify(pin) {
  if (!config) return true;
  const digest = await derivePinDigest(pin, fromBase64(config.salt), config.iterations);
  return digestsMatch(digest, config.digest);
}

export async function disable() {
  config = null;
  await metaDelete(KEY);
}

export async function setAutoLock(ms) {
  if (!config) return;
  config = { ...config, autoLockMs: ms };
  await metaSet(KEY, config);
}

/* ── Screen ── */

function renderDots() {
  const wrap = clear($('#lock-dots'));
  for (let i = 0; i < PIN_LENGTH; i += 1) {
    wrap.append(el('div', { class: `dot${i < entry.length ? ' on' : ''}` }));
  }
}

async function submit() {
  const ok = await verify(entry);
  if (ok) {
    entry = '';
    renderDots();
    $('#lock').classList.remove('show');
    document.body.style.overflow = '';
    unlockResolve?.();
    unlockResolve = null;
    return;
  }
  const screen = $('#lock');
  screen.classList.add('wrong');
  $('#lock-msg').textContent = 'That PIN did not match. Try again.';
  setTimeout(() => {
    screen.classList.remove('wrong');
    entry = '';
    renderDots();
  }, 420);
}

function press(digit) {
  if (entry.length >= PIN_LENGTH) return;
  entry += digit;
  renderDots();
  if (entry.length === PIN_LENGTH) setTimeout(submit, 120);
}

function buildKeypad() {
  const pad = clear($('#keypad'));
  for (const n of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
    pad.append(el('button', { class: 'key', type: 'button', text: n, onclick: () => press(n) }));
  }
  pad.append(el('div', { class: 'key blank' }));
  pad.append(el('button', { class: 'key', type: 'button', text: '0', onclick: () => press('0') }));
  pad.append(el('button', {
    class: 'key fn', type: 'button', text: 'Delete', 'aria-label': 'Delete last digit',
    onclick: () => { entry = entry.slice(0, -1); renderDots(); },
  }));
}

/** Show the lock screen and resolve once the right PIN is entered. */
export function lock() {
  if (!config || isLocked()) return Promise.resolve();
  entry = '';
  renderDots();
  $('#lock-msg').textContent = 'Enter your PIN to unlock.';
  $('#lock').classList.add('show');
  document.body.style.overflow = 'hidden';
  return new Promise((resolve) => { unlockResolve = resolve; });
}

export function init() {
  buildKeypad();
  renderDots();

  document.addEventListener('keydown', (e) => {
    if (!isLocked()) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') { entry = entry.slice(0, -1); renderDots(); }
  });

  // Re-lock when the app comes back to the foreground, after the chosen delay.
  document.addEventListener('visibilitychange', () => {
    if (!isEnabled()) return;
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (Date.now() - hiddenAt >= autoLockMs()) lock();
  });
}

export const PIN_DIGITS = PIN_LENGTH;
