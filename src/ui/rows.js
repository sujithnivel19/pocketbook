/**
 * The document row, shared by the Ask and Documents lists.
 *
 * Thumbnail object URLs are cached per document for the life of the session
 * rather than per render: both lists redraw on every store change, and revoking
 * on one render would blank the images in the other.
 */

import { el, formatDate } from './dom.js';

const thumbUrls = new Map();

function thumbUrl(doc) {
  if (!doc.thumbBlob) return null;
  if (!thumbUrls.has(doc.id)) thumbUrls.set(doc.id, URL.createObjectURL(doc.thumbBlob));
  return thumbUrls.get(doc.id);
}

/** Release a deleted or replaced document's cached thumbnail. */
export function forgetThumb(id) {
  const url = thumbUrls.get(id);
  if (url) { URL.revokeObjectURL(url); thumbUrls.delete(id); }
}

export function forgetAllThumbs() {
  thumbUrls.forEach(URL.revokeObjectURL);
  thumbUrls.clear();
}

export function documentRow(doc, index, onOpen) {
  const row = el('button', {
    class: 'doc',
    type: 'button',
    style: `animation: rise 0.4s var(--ease) ${(index * 0.04).toFixed(3)}s backwards`,
    onclick: () => onOpen(doc),
  });

  const badge = el('div', { class: 'doc-ic' });
  const url = thumbUrl(doc);
  if (url) badge.append(el('img', { src: url, alt: '', loading: 'lazy' }));
  else badge.textContent = doc.type.slice(0, 2).toUpperCase();

  const count = doc.fields.length;
  row.append(
    badge,
    el('div', { class: 'doc-b' },
      el('div', { class: 'doc-n', text: doc.name }),
      el('div', { class: 'doc-m', text: `${count} field${count === 1 ? '' : 's'} · ${formatDate(doc.createdAt)}` })),
    el('div', { class: 'tag', text: doc.type }),
  );
  return row;
}
