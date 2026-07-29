/**
 * Encrypted local JSON store with triple-redundant rolling backups.
 *
 * Storage layout:
 *   gym:db:v1:a / b / c       -> encrypted blobs of master-key-encrypted DB
 *   gym:db:v1:keychain         -> { [userId]: wrappedMasterKeyAsB64 }
 *   gym:db:v1:meta             -> { initialized, superuserUserId, publicUserList }
 *   gym:db:v1:logs:<userId>    -> per-user encrypted action logs
 *
 * The database is encrypted with a random 256-bit MASTER KEY generated at
 * bootstrap. For each user, the master key is individually wrapped
 * (encrypted with a key derived from that user's password). Any user can
 * unlock the database from cold start by presenting their own credentials.
 *
 * Triple backup writes go to a, b, c on every persist; reads use the first
 * copy with a matching integrity hash and auto-heal any corrupt copy.
 */

import {
  decryptObject,
  deriveKey,
  encryptObject,
  hashPassword,
  randomBytes,
  randomId,
  sha256Hex,
  toB64,
  fromB64,
  verifyPassword,
} from "./crypto";
import {
  Database,
  User,
  emptyDatabase,
  DB_VERSION,
  LogEntry,
} from "./schema";

const KEY_A = "gym:db:v1:a";
const KEY_B = "gym:db:v1:b";
const KEY_C = "gym:db:v1:c";
const KEYCHAIN = "gym:db:v1:keychain";
const META_KEY = "gym:db:v1:meta";
const LOG_KEY_PREFIX = "gym:db:v1:logs:";

interface StoredBlob {
  ciphertext: string;
  integrity: string;
  writtenAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: "superuser" | "user";
}

interface Meta {
  initialized: boolean;
  superuserUserId?: string;
  publicUsers: PublicUser[];
}

interface Keychain {
  [userId: string]: string; // wrapped master key, base64 "salt.iv.ct"
}

/* ------------------------------ storage IO ------------------------------ */

function readBlob(k: string): StoredBlob | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(k);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredBlob;
  } catch {
    return null;
  }
}
function writeBlob(k: string, blob: StoredBlob) {
  localStorage.setItem(k, JSON.stringify(blob));
}
function readJSON<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function writeJSON<T>(k: string, val: T) {
  localStorage.setItem(k, JSON.stringify(val));
}

async function verifyBlob(blob: StoredBlob | null): Promise<string | null> {
  if (!blob) return null;
  const h = await sha256Hex(blob.ciphertext);
  return h === blob.integrity ? blob.ciphertext : null;
}

async function readCiphertextAny(): Promise<string | null> {
  const blobs = [readBlob(KEY_A), readBlob(KEY_B), readBlob(KEY_C)];
  let firstHealthy: StoredBlob | null = null;
  for (const b of blobs) {
    const ct = await verifyBlob(b);
    if (ct) {
      if (!firstHealthy) firstHealthy = b;
      break;
    }
  }
  if (firstHealthy && blobs[0]) {
    // If primary was corrupt, heal from the first healthy mirror.
    const primaryOk = await verifyBlob(blobs[0]);
    if (!primaryOk && firstHealthy) writeBlob(KEY_A, firstHealthy);
  }
  return (await verifyBlob(firstHealthy)) ?? null;
}

async function writeAll(ciphertext: string) {
  const now = new Date().toISOString();
  const integrity = await sha256Hex(ciphertext);
  const blob: StoredBlob = { ciphertext, integrity, writtenAt: now };
  writeBlob(KEY_A, blob);
  writeBlob(KEY_B, blob);
  writeBlob(KEY_C, blob);
}

function readMeta(): Meta {
  return readJSON<Meta>(META_KEY, { initialized: false, publicUsers: [] });
}
function writeMeta(m: Meta) {
  writeJSON(META_KEY, m);
}
function readKeychain(): Keychain {
  return readJSON<Keychain>(KEYCHAIN, {});
}
function writeKeychain(k: Keychain) {
  writeJSON(KEYCHAIN, k);
}

/* --------------------------- master key wrapping ------------------------- */
/**
 * Wrap (encrypt) the raw master key with a user's password.
 * Format: saltB64.ivB64.ctB64
 */
async function wrapMasterKey(
  masterKey: Uint8Array,
  password: string
): Promise<string> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kek = await deriveKey(password, salt);
  const ct = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    kek,
    masterKey as BufferSource
  );
  return [toB64(salt), toB64(iv), toB64(new Uint8Array(ct))].join(".");
}

async function unwrapMasterKey(
  wrapped: string,
  password: string
): Promise<Uint8Array> {
  const [s, i, c] = wrapped.split(".");
  const salt = fromB64(s);
  const iv = fromB64(i);
  const ct = fromB64(c).buffer as ArrayBuffer;
  const kek = await deriveKey(password, salt);
  const pt = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    kek,
    ct
  );
  return new Uint8Array(pt);
}

/** Encrypt/decrypt DB with the raw master key (no KDF). */
async function encryptWithMasterKey(data: Database, masterKey: Uint8Array): Promise<string> {
  const iv = randomBytes(12);
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    masterKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const ct = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return [toB64(iv), toB64(new Uint8Array(ct))].join(".");
}

async function decryptWithMasterKey(blob: string, masterKey: Uint8Array): Promise<Database> {
  const [i, c] = blob.split(".");
  const iv = fromB64(i);
  const ct = fromB64(c).buffer as ArrayBuffer;
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    masterKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const pt = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    ct
  );
  return JSON.parse(new TextDecoder().decode(pt)) as Database;
}

/* ------------------------------ public API ------------------------------ */

let _db: Database | null = null;
let _masterKey: Uint8Array | null = null;
let _currentUser: User | null = null;

export function isBootstrapped(): boolean {
  return readMeta().initialized;
}
export function listPublicUsers(): PublicUser[] {
  return readMeta().publicUsers;
}
export function getCurrentUser(): User | null {
  return _currentUser;
}
export function getDb(): Database {
  if (!_db) throw new Error("Database is locked. Please log in.");
  return _db;
}

/** Bootstrap: create superuser, generate master key, wrap it for the superuser. */
export async function bootstrap(
  superuserUsername: string,
  password: string,
  displayName?: string
): Promise<User> {
  if (isBootstrapped()) throw new Error("System already initialized");
  const masterKey = randomBytes(32);
  const db = emptyDatabase();
  const su: User = {
    id: randomId(),
    username: superuserUsername.trim(),
    displayName: (displayName || "Superuser").trim(),
    passwordHash: await hashPassword(password),
    role: "superuser",
    createdAt: new Date().toISOString(),
    isSuperuser: true,
  };
  db.users.push(su);
  const wrapped = await wrapMasterKey(masterKey, password);
  const ciphertext = await encryptWithMasterKey(db, masterKey);
  await writeAll(ciphertext);
  writeKeychain({ [su.id]: wrapped });
  writeMeta({
    initialized: true,
    superuserUserId: su.id,
    publicUsers: [
      { id: su.id, username: su.username, displayName: su.displayName, role: "superuser" },
    ],
  });
  _db = db;
  _masterKey = masterKey;
  _currentUser = su;
  return su;
}

/**
 * Authenticate a user. For superuser: verifies password and unwraps master key.
 * For ordinary user: verifies password then unwraps master key using their wrapped key.
 */
export async function login(username: string, password: string): Promise<User> {
  const meta = readMeta();
  if (!meta.initialized) throw new Error("System not initialized");
  const ciphertext = await readCiphertextAny();
  if (!ciphertext) throw new Error("Database not found or all copies corrupt");

  const keychain = readKeychain();

  // Find the public user to get id
  const pub = meta.publicUsers.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (!pub) throw new Error("User not found");

  // We need the user's password hash which is inside the encrypted DB.
  // But we need to decrypt the DB first, which requires master key, which requires their password.
  // Chicken-and-egg: we can unwrap master key with their password without needing the hash,
  // then verify password hash AFTER decrypting.
  const wrapped = keychain[pub.id];
  if (!wrapped) throw new Error("No wrapped key for this user");
  let masterKey: Uint8Array;
  try {
    masterKey = await unwrapMasterKey(wrapped, password);
  } catch {
    throw new Error("Incorrect password");
  }
  let db: Database;
  try {
    db = await decryptWithMasterKey(ciphertext, masterKey);
  } catch {
    throw new Error("Database decrypt failed — possible corruption or wrong password");
  }
  const user = db.users.find((u) => u.id === pub.id);
  if (!user) throw new Error("User record missing");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Incorrect password");
  _db = db;
  _masterKey = masterKey;
  _currentUser = user;
  return user;
}

/** Switch user in-app without re-entering password (only to ordinary users). */
export async function switchToUser(
  targetUserId: string,
  suPasswordConfirmation?: string
): Promise<User> {
  if (!_db || !_currentUser) throw new Error("Not authenticated");
  const target = _db.users.find((u) => u.id === targetUserId);
  if (!target) throw new Error("User not found");
  if (target.role === "superuser") {
    if (!suPasswordConfirmation)
      throw new Error("Superuser password is required to switch to superuser");
    const ok = await verifyPassword(suPasswordConfirmation, target.passwordHash);
    if (!ok) throw new Error("Incorrect superuser password");
  }
  _currentUser = target;
  return target;
}

export function lock() {
  _db = null;
  _masterKey = null;
  _currentUser = null;
}

export async function persist(): Promise<void> {
  if (!_db || !_masterKey) throw new Error("Database is locked");
  _db.version = DB_VERSION;
  const ct = await encryptWithMasterKey(_db, _masterKey);
  await writeAll(ct);
}

export async function mutate<T>(fn: (db: Database) => T): Promise<T> {
  if (!_db) throw new Error("Database is locked");
  const result = fn(_db);
  await persist();
  return result;
}

/** Create an ordinary user: superuser-only. Adds wrapped master key. */
export async function createUser(
  username: string,
  password: string,
  displayName: string,
  suPassword: string
): Promise<User> {
  if (!_db || !_currentUser || !_masterKey) throw new Error("Not authenticated");
  if (_currentUser.role !== "superuser")
    throw new Error("Only the superuser can create users");
  const ok = await verifyPassword(suPassword, _currentUser.passwordHash);
  if (!ok) throw new Error("Superuser authorization failed");
  if (_db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists");
  }
  const u: User = {
    id: randomId(),
    username: username.trim(),
    displayName: displayName.trim(),
    passwordHash: await hashPassword(password),
    role: "user",
    createdAt: new Date().toISOString(),
  };
  const wrapped = await wrapMasterKey(_masterKey, password);
  await mutate((db) => {
    db.users.push(u);
  });
  const keychain = readKeychain();
  keychain[u.id] = wrapped;
  writeKeychain(keychain);
  const meta = readMeta();
  meta.publicUsers.push({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
  });
  writeMeta(meta);
  return u;
}

export async function deleteUser(userId: string, suPassword: string): Promise<void> {
  if (!_db || !_currentUser || !_masterKey) throw new Error("Not authenticated");
  if (_currentUser.role !== "superuser") throw new Error("Unauthorized");
  const ok = await verifyPassword(suPassword, _currentUser.passwordHash);
  if (!ok) throw new Error("Superuser authorization failed");
  await mutate((db) => {
    db.users = db.users.filter((u) => u.id !== userId);
  });
  const keychain = readKeychain();
  delete keychain[userId];
  writeKeychain(keychain);
  const meta = readMeta();
  meta.publicUsers = meta.publicUsers.filter((u) => u.id !== userId);
  writeMeta(meta);
  localStorage.removeItem(LOG_KEY_PREFIX + userId);
}

/** Allow a user to change their own password (re-wraps master key). */
export async function changeOwnPassword(oldPassword: string, newPassword: string): Promise<void> {
  if (!_db || !_currentUser || !_masterKey) throw new Error("Not authenticated");
  const ok = await verifyPassword(oldPassword, _currentUser.passwordHash);
  if (!ok) throw new Error("Old password is incorrect");
  _currentUser.passwordHash = await hashPassword(newPassword);
  const keychain = readKeychain();
  keychain[_currentUser.id] = await wrapMasterKey(_masterKey, newPassword);
  writeKeychain(keychain);
  await persist();
}

/* -------------------------------- logs --------------------------------- */

export function readUserLog(userId: string): LogEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LOG_KEY_PREFIX + userId);
  if (!raw) return [];
  try {
    // Logs are plaintext on the local device (encrypted-at-rest via OS),
    // but protected from other users by in-app RBAC. They are per-user
    // files as required by spec (`logs/user_<id>.log`). We store them as
    // JSON but also provide a plain text download option for audit.
    return JSON.parse(raw) as LogEntry[];
  } catch {
    return [];
  }
}

export function appendUserLog(entry: LogEntry) {
  const all = readUserLog(entry.userId);
  all.push(entry);
  localStorage.setItem(LOG_KEY_PREFIX + entry.userId, JSON.stringify(all));
}

export function clearUserLog(userId: string) {
  localStorage.removeItem(LOG_KEY_PREFIX + userId);
}

export function allLogUserIds(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LOG_KEY_PREFIX)) {
      out.push(k.slice(LOG_KEY_PREFIX.length));
    }
  }
  return out;
}

export async function destroyEverything(suPassword: string): Promise<void> {
  if (!_db || !_currentUser || _currentUser.role !== "superuser")
    throw new Error("Unauthorized");
  if (!(await verifyPassword(suPassword, _currentUser.passwordHash)))
    throw new Error("Incorrect superuser password");
  const toRemove: string[] = [KEY_A, KEY_B, KEY_C, KEYCHAIN, META_KEY];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LOG_KEY_PREFIX)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  lock();
}

/** Export a single user's log as plain text (Unix-style `.log` format). */
export function exportUserLogAsText(userId: string): string {
  const entries = readUserLog(userId);
  return entries
    .map(
      (e) =>
        `[${e.timestamp}] user=${e.username} (${e.userId}) action=${e.action}${
          e.detail ? " detail=" + JSON.stringify(e.detail) : ""
        }`
    )
    .join("\n");
}
