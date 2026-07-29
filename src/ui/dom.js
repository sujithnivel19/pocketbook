/** Small DOM helpers shared by every view. No framework, no build step. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * el('div', {class: 'doc', onclick: fn}, child, 'text')
 * Attributes go through setAttribute; `on*` keys become listeners.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = value ?? '';
  return node.innerHTML;
}

/* ── Icons ── */

export const ICONS = {
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M6 15H4.5A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5V6"/>',
  done: '<path d="M4 12.5l5 5L20 6.5"/>',
  download: '<path d="M12 4v12"/><path d="M7.5 11.5L12 16l4.5-4.5"/><path d="M4 17v2.5A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5V17"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L17 17"/>',
  arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
};

export function icon(name, props = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('stroke-linecap', 'round');
  node.setAttribute('stroke-linejoin', 'round');
  node.setAttribute('aria-hidden', 'true');
  for (const [k, v] of Object.entries(props)) node.setAttribute(k, v);
  node.innerHTML = ICONS[name] || '';
  return node;
}

/* ── Clipboard ── */

export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch { /* Safari without a user gesture, or an insecure origin */ }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  return ok;
}

/** Swap a copy button to a tick for a beat, then back. */
export function flashCopied(button) {
  const svg = button.querySelector('svg');
  button.classList.add('done');
  svg.innerHTML = ICONS.done;
  clearTimeout(button._revert);
  button._revert = setTimeout(() => {
    button.classList.remove('done');
    svg.innerHTML = ICONS.copy;
  }, 1600);
}

export function copyButton(value, label, { small = false } = {}) {
  const button = el('button', {
    class: small ? 'mini-copy' : 'copy-btn',
    type: 'button',
    'aria-label': `Copy ${label}`,
    onclick: async () => {
      if (await copyText(value)) flashCopied(button);
      else toast('Could not reach the clipboard.', 'bad');
    },
  });
  button.append(icon('copy', { 'stroke-width': small ? 2 : 1.9 }));
  return button;
}

/* ── Toast ── */

let toastTimer;
export function toast(message, kind = '') {
  const node = $('#toast');
  node.textContent = message;
  node.className = `toast show ${kind}`.trim();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
}

/* ── Misc ── */

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Object URLs leak if they're never revoked, and these point at document scans.
 * Each caller gets a bag it can empty when its view is torn down.
 */
export function urlBag() {
  const urls = [];
  return {
    for(blob) { const url = URL.createObjectURL(blob); urls.push(url); return url; },
    release() { urls.splice(0).forEach(URL.revokeObjectURL); },
  };
}
