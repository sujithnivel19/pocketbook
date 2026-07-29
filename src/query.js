/**
 * Answering a question.
 *
 * Keyword matching against extracted field labels — not language understanding.
 * That is a deliberate consequence of the local-only promise: real comprehension
 * needs an API call, and no request leaves this device. The UI must never imply
 * more than this delivers.
 */

const SYNONYMS = [
  { field: 'Aadhaar Number', words: ['aadhar', 'aadhaar', 'adhar', 'uid', 'uidai'] },
  { field: 'PAN Number', words: ['pan', 'permanent account'] },
  { field: 'Passport Number', words: ['passport'] },
  { field: 'Voter ID', words: ['voter', 'epic'] },
  { field: 'Vehicle Number', words: ['vehicle', 'car number', 'bike number', 'registration number', 'rc'] },
  { field: 'IFSC Code', words: ['ifsc', 'branch code'] },
  { field: 'GSTIN', words: ['gst', 'gstin'] },
  { field: 'Account Number', words: ['account number', 'account no', 'a/c'] },
  { field: 'Phone', words: ['phone', 'mobile', 'contact', 'number to call'] },
  { field: 'Email', words: ['email', 'e-mail', 'mail id'] },
  { field: 'Amount', words: ['amount', 'total', 'due', 'bill', 'payable', 'how much', 'cost', 'paid'] },
  { field: 'Date', words: ['expire', 'expiry', 'expires', 'valid till', 'valid until', 'due date', 'date', 'when'] },
];

/** Words that carry no signal about *which* field is wanted. */
const STOP = new Set([
  'what', 'whats', 'what\'s', 'is', 'my', 'the', 'a', 'an', 'of', 'me', 'show',
  'tell', 'find', 'get', 'give', 'i', 'do', 'have', 'for', 'on', 'in', 'number',
  'no', 'please', 'and', 'from', 'that', 'this', 'it', 'me', 'again',
]);

const norm = (s) => s.toLowerCase().replace(/[^\w\s@./'-]/g, ' ').replace(/\s+/g, ' ').trim();

function tokens(text) {
  return norm(text).split(' ').filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Score one field against a query. Higher is better; 0 means no match.
 * The tiers are deliberately far apart so a synonym hit always beats a
 * loose text match rather than being nudged past it by a longer document.
 */
function scoreField(field, query, words) {
  const label = field.label.toLowerCase();
  const value = String(field.value).toLowerCase();
  let score = 0;

  for (const { field: name, words: syn } of SYNONYMS) {
    if (field.label !== name) continue;
    for (const w of syn) {
      if (query.includes(w)) { score = Math.max(score, 100 + w.length); break; }
    }
  }

  if (label === query) score = Math.max(score, 90);
  else if (query.includes(label) || label.includes(query)) score = Math.max(score, 70);

  for (const w of words) {
    if (label.includes(w)) score = Math.max(score, 55 + w.length);
    else if (value.includes(w)) score = Math.max(score, 30 + w.length);
  }

  return score;
}

/**
 * @param {string} raw the question as typed
 * @param {object[]} docs newest-first
 * @returns {{best: {field, doc, score}|null, others: {field, doc, score}[]}}
 */
export function answer(raw, docs) {
  const query = norm(raw);
  const words = tokens(raw);
  if (!query) return { best: null, others: [] };

  const hits = [];
  docs.forEach((doc, index) => {
    let bestForDoc = null;
    for (const field of doc.fields || []) {
      const score = scoreField(field, query, words);
      if (score && (!bestForDoc || score > bestForDoc.score)) bestForDoc = { field, doc, score };
    }
    // A document whose name or category matches is worth surfacing even when
    // no single field does — "electricity bill" should find the bill.
    if (!bestForDoc && words.length) {
      const haystack = `${doc.name} ${doc.type}`.toLowerCase();
      if (words.some((w) => haystack.includes(w)) && doc.fields?.length) {
        bestForDoc = { field: doc.fields[0], doc, score: 20 };
      }
    }
    if (bestForDoc) hits.push({ ...bestForDoc, index });
  });

  // Newest wins ties: `index` is the position in a newest-first list.
  hits.sort((a, b) => b.score - a.score || a.index - b.index);
  return { best: hits[0] || null, others: hits.slice(1, 5) };
}

export const SUGGESTIONS = [
  "what's my aadhaar number",
  "what's my pan number",
  'when does my licence expire',
  'electricity bill amount',
];
