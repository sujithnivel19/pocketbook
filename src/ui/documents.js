/**
 * The Documents view: category filters and the full list.
 */

import { CATEGORIES } from '../extract.js';
import { state, filteredDocs, setFilter, subscribe } from '../store.js';
import { $, el, clear } from './dom.js';
import { documentRow } from './rows.js';

let onOpenDocument = () => {};
let onSeed = () => {};

/** Empty categories are hidden, so the row grows with the library. */
function renderFilters() {
  const wrap = clear($('#filters'));
  if (!state.docs.length) return;

  const counts = { All: state.docs.length };
  CATEGORIES.forEach((c) => { counts[c] = state.docs.filter((d) => d.type === c).length; });
  const shown = ['All', ...CATEGORIES.filter((c) => counts[c] > 0)];
  if (!shown.includes(state.filter)) state.filter = 'All';

  for (const category of shown) {
    wrap.append(el('button', {
      class: `chip${category === state.filter ? ' on' : ''}`,
      type: 'button',
      'aria-pressed': category === state.filter,
      onclick: () => setFilter(category),
    }, category, el('span', { class: 'n', text: String(counts[category]) })));
  }
}

function renderList() {
  const list = clear($('#doc-list'));
  const docs = filteredDocs();

  if (!docs.length) {
    if (state.filter !== 'All') {
      list.append(el('div', { class: 'empty' },
        el('b', { text: `No ${state.filter.toLowerCase()} documents` }),
        'Nothing saved under this category yet.'));
      return;
    }
    list.append(el('div', { class: 'empty' },
      el('b', { text: 'Nothing stored yet' }),
      'Tap the + button to store your first one.',
      el('br'),
      el('button', { class: 'seed', type: 'button', text: 'Load sample documents', onclick: () => onSeed() })));
    return;
  }

  docs.forEach((doc, i) => list.append(documentRow(doc, i, onOpenDocument)));
}

export function init({ openDocument, seed }) {
  onOpenDocument = openDocument;
  onSeed = seed;
  subscribe(() => { renderFilters(); renderList(); });
}
