/**
 * The Ask view: greeting, the ask bar and overlay, and the answer card.
 */

import { metaGet, metaSet, putRecent, recents, clearRecents } from '../db.js';
import { answer, SUGGESTIONS } from '../query.js';
import { state, subscribe } from '../store.js';
import {
  $, el, clear, icon, copyButton, urlBag, formatDate, toast, download,
} from './dom.js';
import { documentRow } from './rows.js';

const RECENT_LIMIT = 4;

/** Holds only the answer card's full-size preview; released on every redraw. */
const bag = urlBag();
let onOpenDocument = () => {};
let onSeeAll = () => {};

/* ── Greeting ──
   Warmth is front-loaded and decays with familiarity: a screen that still says
   "Welcome!" on the fortieth visit reads as a script, not a greeting. */

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export async function renderGreeting(docCount) {
  const visits = (await metaGet('visits', 0)) + 1;
  await metaSet('visits', visits);

  let title;
  let sub;
  if (visits === 1) {
    title = 'Welcome to<br>your pocketbook.';
    sub = 'Add a document, then ask for anything inside it in plain words. Everything stays on this phone.';
  } else if (visits <= 3) {
    title = 'Good to see<br>you again.';
    sub = docCount
      ? 'Ask for anything inside your documents — Aadhaar, PAN, a bill amount, an expiry date.'
      : 'Add your first document and it becomes searchable straight away.';
  } else {
    title = `${timeOfDay()}.`;
    sub = docCount
      ? `${docCount} document${docCount === 1 ? '' : 's'} stored on this phone. What do you need?`
      : 'Nothing stored yet — add a document to get started.';
  }
  $('#hero-title').innerHTML = title;
  $('#hero-sub').textContent = sub;
}

/* ── Answer card ── */

function fallbackText(doc) {
  const body = doc.fields.map((f) => `${f.label}: ${f.value}`).join('\n');
  return `${doc.name} (${doc.type})\n\n${body}\n`;
}

/** Copy hands over a value to paste; download hands over the scan to attach. */
function downloadSource(doc) {
  if (doc.fileBlob) {
    const ext = (doc.fileBlob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const base = doc.name.replace(/\.[^.]+$/, '');
    download(doc.fileBlob, `${base}.${ext}`);
  } else {
    download(new Blob([fallbackText(doc)], { type: 'text/plain' }), `${doc.name.replace(/\.[^.]+$/, '')}.txt`);
  }
  toast('Saved to your device — outside the vault.');
}

function sourcePreview(doc) {
  const thumb = el('div', { class: 'thumb' });
  if (doc.fileBlob) {
    thumb.append(el('img', { src: bag.for(doc.fileBlob), alt: `Scan of ${doc.name}`, loading: 'lazy' }));
  } else {
    const empty = el('div', { class: 'noimg' }, icon('image', { 'stroke-width': 1.8 }), 'No image stored');
    thumb.append(empty);
  }
  const dl = el('button', {
    class: 'dl-overlay', type: 'button',
    'aria-label': `Download ${doc.name}`,
    onclick: () => downloadSource(doc),
  });
  dl.append(icon('download', { 'stroke-width': 2 }));
  thumb.append(dl);

  return el('div', { class: 'srcdoc' },
    thumb,
    el('div', { class: 'srcname' },
      el('span', { class: 'nm', text: doc.name }),
      el('span', { text: `${doc.type} · ${formatDate(doc.createdAt)}` })));
}

function renderHit(hit, others, card) {
  const { field, doc } = hit;

  card.append(el('div', { class: 'k', text: field.label }));
  card.append(el('div', { class: 'vrow' },
    el('div', { class: 'v', text: field.value }),
    copyButton(field.value, field.label)));

  // Everything else on the same document: ask for an Aadhaar number and the
  // name and date of birth come with it, one tap from the clipboard.
  const rest = doc.fields.filter((f) => !(f.label === field.label && f.value === field.value));
  if (rest.length) {
    card.append(el('div', { class: 'also', text: 'Also in this document' }));
    for (const f of rest) {
      card.append(el('div', { class: 'afield' },
        el('span', { class: 'al', text: f.label }),
        el('span', { class: 'av', text: f.value }),
        copyButton(f.value, f.label, { small: true })));
    }
  }

  card.append(sourcePreview(doc));

  if (others.length) {
    const row = el('div', { class: 'alts-row' });
    for (const other of others) {
      row.append(el('button', {
        class: 'alt', type: 'button',
        text: `${other.doc.name} · ${other.field.label}`,
        onclick: () => show(other, others.filter((o) => o !== other).concat(hit)),
      }));
    }
    card.append(el('div', { class: 'alts' }, el('div', { class: 'also', text: 'Other matches' }), row));
  }
}

function show(hit, others) {
  const card = $('#answer');
  bag.release();
  clear(card);
  card.classList.remove('miss');
  card.classList.add('show');
  $('#v-ask').classList.add('results');

  const dismiss = el('button', { class: 'answer-x', type: 'button', 'aria-label': 'Dismiss answer', onclick: hide });
  dismiss.append(icon('close', { 'stroke-width': 2.2 }));
  card.append(dismiss);

  if (!hit) {
    card.classList.add('miss');
    card.append(el('div', { class: 'k', text: 'Nothing stored yet' }));
    card.append(el('div', { class: 'vrow' },
      el('div', { class: 'v', text: 'Add the document that holds this, and ask again.' })));
    return;
  }
  renderHit(hit, others, card);
}

export function hide() {
  bag.release();
  const card = $('#answer');
  card.classList.remove('show');
  clear(card);
  $('#v-ask').classList.remove('results');
}

/* ── Overlay ── */

const overlay = () => $('#ovl');
const queryInput = () => $('#q-input');

async function renderRecents() {
  const wrap = clear($('#recents'));
  const rows = await recents(8);
  const isHistory = rows.length > 0;
  const items = isHistory ? rows.map((r) => r.q) : SUGGESTIONS;

  const head = el('div', { class: 'rec-head' }, el('span', { text: isHistory ? 'Recent' : 'Try asking' }));
  if (isHistory) {
    head.append(el('button', {
      class: 'rec-clear', type: 'button', text: 'Clear',
      onclick: async (e) => { e.stopPropagation(); await clearRecents(); renderRecents(); },
    }));
  }
  wrap.append(head);

  items.forEach((q, i) => {
    const row = el('button', {
      class: 'rec', type: 'button',
      style: `animation: rise 0.34s var(--ease) ${(0.06 + i * 0.035).toFixed(3)}s backwards`,
      onclick: () => { queryInput().value = q; run(); },
    });
    row.append(
      el('div', { class: 'rec-ic' }, icon(isHistory ? 'clock' : 'search', { 'stroke-width': 2 })),
      el('div', { class: 'rec-t', text: q }),
      el('div', { class: 'rec-arrow' }, icon('arrow', { 'stroke-width': 2 })),
    );
    wrap.append(row);
  });
}

export async function openOverlay() {
  await renderRecents();
  overlay().classList.add('open');
  setTimeout(() => queryInput().focus(), 60);
}

export function closeOverlay() {
  overlay().classList.remove('open');
  queryInput().blur();
}

export const isOverlayOpen = () => overlay().classList.contains('open');

async function run() {
  const raw = queryInput().value.trim();
  if (!raw) return;
  await putRecent(raw);
  const { best, others } = answer(raw, state.docs);
  show(best, others);
  closeOverlay();
  $('#sb-ph').textContent = raw;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Recent documents strip ── */

function renderRecentDocs() {
  const list = clear($('#ask-list'));
  const docs = state.docs.slice(0, RECENT_LIMIT);
  $('#see-all').hidden = state.docs.length <= RECENT_LIMIT;

  if (!docs.length) {
    list.append(el('div', { class: 'empty' },
      el('b', { text: 'Nothing stored yet' }),
      'Tap the + button to add your first document.'));
    return;
  }
  docs.forEach((doc, i) => list.append(documentRow(doc, i, onOpenDocument)));
}

/* ── Wiring ── */

export function init({ openDocument, seeAll }) {
  onOpenDocument = openDocument;
  onSeeAll = seeAll;

  $('#sb-open').addEventListener('click', openOverlay);
  $('#q-cancel').addEventListener('click', closeOverlay);
  $('#q-go').addEventListener('click', run);
  $('#see-all').addEventListener('click', () => onSeeAll());
  queryInput().addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  overlay().addEventListener('click', (e) => { if (e.target === overlay()) closeOverlay(); });

  subscribe(renderRecentDocs);
}
