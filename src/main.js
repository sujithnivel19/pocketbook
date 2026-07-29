/**
 * Pocketbook — bootstrap.
 *
 * Opens the database, restores the lock, wires the views together and registers
 * the service worker. Nothing here reaches the network except that registration.
 */

import { open as openDb } from './db.js';
import { state, reload, emit, setFilter } from './store.js';
import { seed } from './samples.js';
import { $, $$, toast } from './ui/dom.js';
import { isSheetOpen, topSheet, closeSheet } from './ui/sheets.js';
import * as ask from './ui/ask.js';
import * as documents from './ui/documents.js';
import * as review from './ui/review.js';
import * as detail from './ui/detail.js';
import * as capture from './ui/capture.js';
import * as settings from './ui/settings.js';
import * as lock from './ui/lock.js';

/* ── Tabs ── */

function setView(name) {
  state.view = name;
  for (const tab of $$('.tab')) {
    const on = tab.dataset.view === name;
    tab.classList.toggle('on', on);
    if (on) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  for (const view of $$('.view')) view.classList.remove('active');
  $(`#v-${name}`).classList.add('active');
  capture.setDial(false);
}

function wireTabs() {
  for (const tab of $$('.tab')) {
    tab.addEventListener('click', () => {
      // Tapping Ask while already there clears the answer and restores the hero.
      if (tab.dataset.view === 'ask' && tab.classList.contains('on')) ask.hide();
      setView(tab.dataset.view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/* ── Escape closes whatever is on top ── */

function wireEscape() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (lock.isLocked()) return;
    if (ask.isOverlayOpen()) { ask.closeOverlay(); return; }
    if (capture.isDialOpen()) { capture.setDial(false); return; }
    if (isSheetOpen()) closeSheet(topSheet());
  });
}

/* ── Service worker ── */

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return; // modules and SW both need a real origin
  try {
    // sw.js sits at the app root, so its default scope already covers the app.
    const registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url));
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          toast('An update is ready — reopen Pocketbook to apply it.');
        }
      });
    });
  } catch (err) {
    console.warn('Service worker registration failed', err);
  }
}

/* ── Start ── */

async function start() {
  await openDb();
  await lock.load();
  lock.init();
  if (lock.isEnabled()) await lock.lock();

  ask.init({
    openDocument: detail.open,
    seeAll: () => { setView('docs'); setFilter('All'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  });
  documents.init({
    openDocument: detail.open,
    seed: async () => { await seed(); await reload(); toast('Sample documents loaded.'); },
  });
  review.init();
  detail.init();
  capture.init();
  settings.init();
  wireTabs();
  wireEscape();

  const docs = await reload();
  await ask.renderGreeting(docs.length);
  emit();

  registerServiceWorker();
}

start().catch((err) => {
  console.error(err);
  document.body.innerHTML = '<div style="padding:60px 24px;text-align:center;color:#7E858F;font-family:sans-serif">'
    + '<p style="color:#F2F3F5;font-size:18px;margin-bottom:8px">Pocketbook could not start.</p>'
    + '<p>This browser may be blocking local storage — private browsing often does.</p></div>';
});
