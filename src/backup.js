/**
 * Encrypted backup and restore.
 *
 * The single-device failure mode is the real cost of storing everything locally:
 * lose the phone, or clear the browser's data, and the vault is gone. A backup
 * is the answer, but an unencrypted one would hand over every ID number in a
 * file the user then emails to themselves — so the export is always encrypted
 * under a passphrase the app never keeps.
 */

import { allDocs, addDoc } from './db.js';
import { encryptJson, decryptJson, toBase64, fromBase64 } from './crypto.js';

export const FORMAT = 'pocketbook.backup';
export const FORMAT_VERSION = 1;
export const EXTENSION = '.pocketbook';

async function blobToBase64(blob) {
  if (!blob) return null;
  return { type: blob.type || 'application/octet-stream', data: toBase64(await blob.arrayBuffer()) };
}

function base64ToBlob(record) {
  if (!record) return undefined;
  return new Blob([fromBase64(record.data)], { type: record.type });
}

/**
 * @param {string} passphrase
 * @returns {Promise<{blob: Blob, filename: string, count: number}>}
 */
export async function exportAll(passphrase) {
  const docs = await allDocs();
  if (!docs.length) throw new Error('There is nothing to back up yet.');

  const payload = await Promise.all(docs.map(async (d) => ({
    name: d.name,
    type: d.type,
    text: d.text,
    fields: d.fields,
    source: d.source,
    createdAt: d.createdAt,
    fileBlob: await blobToBase64(d.fileBlob),
    thumbBlob: await blobToBase64(d.thumbBlob),
  })));

  const envelope = await encryptJson({ documents: payload }, passphrase);
  const file = {
    format: FORMAT,
    version: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    documentCount: docs.length,
    kdf: { name: 'PBKDF2', hash: envelope.hash, iterations: envelope.iterations, salt: envelope.salt },
    cipher: envelope.cipher,
    iv: envelope.iv,
    data: envelope.data,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    blob: new Blob([JSON.stringify(file)], { type: 'application/json' }),
    filename: `pocketbook-${stamp}${EXTENSION}`,
    count: docs.length,
  };
}

/**
 * Restores into the existing vault rather than replacing it, skipping documents
 * that are already present — restoring the same file twice is a no-op.
 *
 * @returns {Promise<{added: number, skipped: number}>}
 */
export async function importAll(file, passphrase) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not a Pocketbook backup.');
  }
  if (parsed?.format !== FORMAT) throw new Error('That file is not a Pocketbook backup.');
  if (parsed.version > FORMAT_VERSION) {
    throw new Error('That backup was made by a newer version of Pocketbook.');
  }

  let payload;
  try {
    payload = await decryptJson(
      { salt: parsed.kdf.salt, iv: parsed.iv, iterations: parsed.kdf.iterations, data: parsed.data },
      passphrase,
    );
  } catch {
    throw new Error('Wrong passphrase — nothing was restored.');
  }

  const existing = await allDocs();
  const seen = new Set(existing.map((d) => `${d.name}|${d.createdAt}`));

  let added = 0;
  let skipped = 0;
  for (const d of payload.documents || []) {
    if (seen.has(`${d.name}|${d.createdAt}`)) { skipped += 1; continue; }
    await addDoc({
      name: d.name,
      type: d.type,
      text: d.text || '',
      fields: d.fields || [],
      source: d.source || 'restore',
      createdAt: d.createdAt || Date.now(),
      fileBlob: base64ToBlob(d.fileBlob),
      thumbBlob: base64ToBlob(d.thumbBlob),
    });
    seen.add(`${d.name}|${d.createdAt}`);
    added += 1;
  }
  return { added, skipped };
}
