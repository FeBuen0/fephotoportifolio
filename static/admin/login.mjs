import { fromBase64 } from './core.mjs';

export const ADMIN_USERNAME = 'Bumoro';
const SALT = 'e+C0gwajXCC+pqSVGUWmzQ==';
const CHECK = '3tifJScVQr1iiSEH9WU3nwo1oJmw8XLTbl9zrcouGCI=';

// This local check selects the owner's login; GitHub authorizes every write.
// Never put a GitHub token or the plaintext password in this public module.
export async function verifyLogin(username, password) {
  if (username !== ADMIN_USERNAME || typeof password !== 'string' || password.length < 6 || password.length > 256) return false;
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromBase64(SALT), iterations: 600000, hash: 'SHA-256' }, material, 256));
  const expected = fromBase64(CHECK);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= result[index] ^ expected[index];
  return difference === 0;
}
