import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run auth:hash -- <password>");
  process.exit(1);
}

const n = 16_384;
const r = 8;
const p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
console.log(["scrypt", n, r, p, salt.toString("base64"), hash.toString("base64")].join("$"));
