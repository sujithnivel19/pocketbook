/**
 * WebCrypto helpers for the PIN and for encrypted backups.
 *
 * PBKDF2-SHA256 for key derivation, AES-256-GCM for the backup file. No key
 * material is stored — the PIN check keeps only a salted derivation, and the
 * backup key exists for the length of one export or import.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export const PIN_ITERATIONS = 310_000;
export const BACKUP_ITERATIONS = 420_000;

export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export function toBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const CHUNK = 0x8000; // keep the argument list under the call-stack limit
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function baseKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
}

/** Salted derivation used to check a PIN without storing it. */
export async function derivePinDigest(pin, salt, iterations = PIN_ITERATIONS) {
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    await baseKey(pin),
    256,
  );
  return toBase64(bits);
}

async function deriveAesKey(passphrase, salt, iterations) {
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    await baseKey(passphrase),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Constant-time-ish comparison; both operands are base64 of the same length. */
export function digestsMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function encryptJson(value, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveAesKey(passphrase, salt, BACKUP_ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(value)),
  );
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    iterations: BACKUP_ITERATIONS,
    hash: 'SHA-256',
    cipher: 'AES-GCM',
    data: toBase64(cipher),
  };
}

export async function decryptJson(envelope, passphrase) {
  const key = await deriveAesKey(
    passphrase,
    fromBase64(envelope.salt),
    envelope.iterations || BACKUP_ITERATIONS,
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
    key,
    fromBase64(envelope.data),
  );
  return JSON.parse(dec.decode(plain));
}
