import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Passwort-Hashing mit scrypt aus node:crypto (keine externe Dependency).
 * Format: scrypt:<N>:<r>:<p>:<salt b64url>:<hash b64url>
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function scryptAsync(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, { N: n, r, p, maxmem: 128 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, N, R, P);
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const salt = Buffer.from(parts[4]!, 'base64url');
  const expected = Buffer.from(parts[5]!, 'base64url');
  if (salt.length === 0 || expected.length !== KEY_LEN) return false;
  const actual = await scryptAsync(password, salt, n, r, p);
  return timingSafeEqual(actual, expected);
}
