import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createContentStore } from './github-content.mjs';

const scrypt = promisify(scryptCallback);
const COOKIE = '__Host-fephotos_admin';
const SESSION_SECONDS = 4 * 60 * 60;
const MAX_BODY = 4_500_000;
const SCRYPT = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 256) {
    throw new Error('Use uma senha com 16 a 256 caracteres.');
  }
  const salt = randomBytes(32).toString('hex');
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

function constantEqual(a, b) {
  return timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());
}

function configured(env) {
  return typeof env.FEPHOTOS_ADMIN_USERNAME === 'string' && env.FEPHOTOS_ADMIN_USERNAME.length > 0
    && /^scrypt\$[a-f0-9]{64}\$[a-f0-9]{128}$/.test(env.FEPHOTOS_ADMIN_PASSWORD_HASH || '')
    && (env.FEPHOTOS_SESSION_SECRET || '').length >= 64
    && Boolean(env.FEPHOTOS_GITHUB_TOKEN);
}

async function validPassword(password, hash) {
  const [, salt, stored] = hash.split('$');
  const key = await scrypt(password, salt, 64, SCRYPT);
  return timingSafeEqual(Buffer.from(stored, 'hex'), key);
}

function sessionKey(env) {
  // Rotating either password or session secret invalidates every old session.
  return createHmac('sha256', env.FEPHOTOS_SESSION_SECRET)
    .update(`${env.FEPHOTOS_ADMIN_USERNAME}:${env.FEPHOTOS_ADMIN_PASSWORD_HASH}`).digest();
}

function signature(value, env) { return createHmac('sha256', sessionKey(env)).update(value).digest('base64url'); }

function makeSession(env, now) {
  const session = { username: env.FEPHOTOS_ADMIN_USERNAME, csrf: randomBytes(32).toString('hex'),
    expiresAt: now + SESSION_SECONDS * 1000 };
  const encoded = Buffer.from(JSON.stringify(session)).toString('base64url');
  return { session, token: `${encoded}.${signature(encoded, env)}` };
}

function readSession(request, env, now) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const value = cookie.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!value || value.length > 2048) return null;
    const pieces = value.split('.');
    if (pieces.length !== 2 || !constantEqual(pieces[1], signature(pieces[0], env))) return null;
    const session = JSON.parse(Buffer.from(pieces[0], 'base64url').toString('utf8'));
    if (!constantEqual(session.username, env.FEPHOTOS_ADMIN_USERNAME)
      || !/^[a-f0-9]{64}$/.test(session.csrf) || !Number.isFinite(session.expiresAt)
      || session.expiresAt <= now || session.expiresAt > now + SESSION_SECONDS * 1000) return null;
    return session;
  } catch { return null; }
}

function cookie(token, maxAge = SESSION_SECONDS) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie', ...extra,
  } });
}

async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new HttpError(415, 'Formato de envio inválido.');
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new HttpError(413, 'Envie arquivos menores ou em grupos menores.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Envio inválido.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new HttpError(413, 'Envie arquivos menores ou em grupos menores.'); }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, 'Envio inválido.'); }
}

export function createAdminHandler(env = process.env, { fetchImpl = fetch, now = Date.now } = {}) {
  const store = createContentStore(env, fetchImpl);
  return async request => {
    try {
      const url = new URL(request.url);
      const action = url.pathname.replace(/^\/api\/admin\//, '');
      const expectedMethod = action === 'session' ? 'GET' : ['login', 'logout', 'cms'].includes(action) ? 'POST' : null;
      // No signup, invitation, reset, password update, or user-management route exists.
      if (!expectedMethod) return json({ error: 'Não encontrado.' }, 404);
      if (request.method !== expectedMethod) return json({ error: 'Método inválido.' }, 405, { Allow: expectedMethod });
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return json({ error: 'Use uma conexão segura.' }, 400);
      if (!configured(env)) return json({ error: 'O acesso ao painel ainda não foi ativado.' }, 503);
      if (request.method === 'POST') {
        if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
          return json({ error: 'Origem não permitida.' }, 403);
        }
      }
      if (action === 'login') {
        const { username, password } = await readJson(request);
        if (typeof username !== 'string' || username.length > 80 || typeof password !== 'string' || password.length > 256) {
          return json({ error: 'Usuário ou senha incorretos.' }, 401);
        }
        // Always hash, including for unknown usernames.
        const passwordMatches = await validPassword(password, env.FEPHOTOS_ADMIN_PASSWORD_HASH);
        if (!constantEqual(username, env.FEPHOTOS_ADMIN_USERNAME) || !passwordMatches) return json({ error: 'Usuário ou senha incorretos.' }, 401);
        const { session, token } = makeSession(env, now());
        return json({ ...session, name: session.username }, 200, { 'Set-Cookie': cookie(token) });
      }
      const session = readSession(request, env, now());
      if (!session) return json({ error: 'Entre novamente para continuar.' }, 401, { 'Set-Cookie': cookie('', 0) });
      if (action === 'session') return json({ ...session, name: session.username });
      if (!constantEqual(request.headers.get('x-csrf-token') || '', session.csrf)) return json({ error: 'Sessão inválida. Entre novamente.' }, 403);
      if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
      const payload = await readJson(request);
      return json(await store.dispatch(payload));
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      return json({ error: status < 500 ? error.message : 'Não foi possível concluir. Tente novamente.' }, status);
    }
  };
}
