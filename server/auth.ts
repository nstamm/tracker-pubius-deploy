import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });

  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPassword(password: string, encodedHash: string): boolean {
  const [algorithm, n, r, p, saltValue, hashValue] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltValue || !hashValue) {
    return false;
  }

  try {
    const expected = Buffer.from(hashValue, "base64");
    const actual = scryptSync(password, Buffer.from(saltValue, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
