/**
 * Encryption engine — AES-GCM 256 via Web Crypto API.
 * All data at rest is encrypted with a key derived from the user's password
 * using PBKDF2 with 210,000 iterations.
 */

const PBKDF2_ITERATIONS = 210_000;
const SALT_LEN = 16;
const IV_LEN = 12;

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function getSubtle(): SubtleCrypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API unavailable");
  }
  return window.crypto.subtle;
}

function getRandomValues(n: number): Uint8Array {
  const b = new Uint8Array(new ArrayBuffer(n));
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(b);
  } else {
    for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  }
  return b;
}

export function randomBytes(n: number): Uint8Array {
  return getRandomValues(n);
}

export function randomId(): string {
  return toB64(randomBytes(9)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
}

/** Derive an AES-GCM 256-bit key from a password + salt. */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptObject(
  data: unknown,
  password: string
): Promise<string> {
  const salt = getRandomValues(SALT_LEN);
  const iv = getRandomValues(IV_LEN);
  const key = await deriveKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const subtle = getSubtle();
  const ct = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoded
  );
  return [
    toB64(salt),
    toB64(iv),
    toB64(new Uint8Array(ct)),
  ].join(".");
}

export async function decryptObject<T = unknown>(
  blob: string,
  password: string
): Promise<T> {
  const parts = blob.split(".");
  if (parts.length !== 3) throw new Error("Corrupt encrypted blob");
  const salt = fromB64(parts[0]);
  const iv = fromB64(parts[1]);
  const ct = fromB64(parts[2]).buffer as ArrayBuffer;
  const key = await deriveKey(password, salt);
  const subtle = getSubtle();
  const pt = await subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct
  );
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

/** SHA-256 hex digest for integrity checks (not for passwords). */
export async function sha256Hex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const subtle = getSubtle();
  const buf = await subtle.digest("SHA-256", enc.encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Password hash used for login verification (salted PBKDF2). */
export async function hashPassword(password: string): Promise<string> {
  const salt = getRandomValues(SALT_LEN);
  const enc = new TextEncoder();
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    256
  );
  return `p2$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "p2") return false;
    const salt = fromB64(parts[1]);
    const expected = fromB64(parts[2]);
    const enc = new TextEncoder();
    const subtle = getSubtle();
    const baseKey = await subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const bits = new Uint8Array(
      await subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: salt as BufferSource,
          iterations: PBKDF2_ITERATIONS,
          hash: "SHA-256",
        },
        baseKey,
        256
      )
    );
    if (bits.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
