/**
 * The app's shared state: the document list and the active category filter.
 *
 * Views subscribe rather than calling each other, so a save from the review
 * sheet and a delete from the detail sheet both take the same path.
 */

import { allDocs } from './db.js';

const listeners = new Set();

export const state = {
  docs: [],
  filter: 'All',
  view: 'ask',
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  listeners.forEach((fn) => fn(state));
}

/** Re-read the vault and notify every view. */
export async function reload() {
  state.docs = await allDocs();
  emit();
  return state.docs;
}

export function setFilter(filter) {
  state.filter = filter;
  emit();
}

export function filteredDocs() {
  return state.filter === 'All' ? state.docs : state.docs.filter((d) => d.type === state.filter);
}
