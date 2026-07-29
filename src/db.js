/**
 * IndexedDB, promisified.
 *
 * Three stores: `documents` (the vault itself), `recents` (asked questions),
 * `meta` (settings, visit count, lock credentials). Nothing here talks to the
 * network — this file is the entire persistence layer.
 */

const DB_NAME = 'pocketbook';
const DB_VERSION = 1;
export const DOCS = 'documents';
export const RECS = 'recents';
export const META = 'meta';

let db = null;

export function open() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(DOCS)) {
        d.createObjectStore(DOCS, { keyPath: 'id', autoIncrement: true })
          .createIndex('createdAt', 'createdAt');
      }
      if (!d.objectStoreNames.contains(RECS)) d.createObjectStore(RECS, { keyPath: 'q' });
      if (!d.objectStoreNames.contains(META)) d.createObjectStore(META, { keyPath: 'k' });
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      db.onversionchange = () => { db.close(); db = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

function run(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      t.oncomplete = () => resolve();
    }
  });
}

/* ── Documents ── */

export const addDoc = (doc) => run(DOCS, 'readwrite', (s) => s.add(doc));
export const putDoc = (doc) => run(DOCS, 'readwrite', (s) => s.put(doc));
export const getDoc = (id) => run(DOCS, 'readonly', (s) => s.get(id));
export const deleteDoc = (id) => run(DOCS, 'readwrite', (s) => s.delete(id));
export const clearDocs = () => run(DOCS, 'readwrite', (s) => s.clear());

/** Newest first — every list in the app reads in this order. */
export async function allDocs() {
  const docs = await run(DOCS, 'readonly', (s) => s.getAll());
  return docs.sort((a, b) => b.createdAt - a.createdAt);
}

/* ── Recent questions ── */

export const putRecent = (q) => run(RECS, 'readwrite', (s) => s.put({ q, at: Date.now() }));
export const clearRecents = () => run(RECS, 'readwrite', (s) => s.clear());

export async function recents(limit = 8) {
  const all = await run(RECS, 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}

/* ── Meta ── */

export async function metaGet(key, fallback = null) {
  const row = await run(META, 'readonly', (s) => s.get(key));
  return row === undefined || row === null ? fallback : row.v;
}
export const metaSet = (k, v) => run(META, 'readwrite', (s) => s.put({ k, v }));
export const metaDelete = (k) => run(META, 'readwrite', (s) => s.delete(k));

/** Approximate bytes held by the vault — shown in Settings. */
export async function usage() {
  if (navigator.storage?.estimate) {
    try {
      const { usage: used } = await navigator.storage.estimate();
      if (typeof used === 'number') return used;
    } catch { /* fall through to the manual count */ }
  }
  const docs = await allDocs();
  return docs.reduce((n, d) => n + (d.fileBlob?.size || 0) + (d.thumbBlob?.size || 0) + (d.text?.length || 0), 0);
}
