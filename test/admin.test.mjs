import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAdminHandler, hashPassword } from '../server/admin.mjs';
import { createContentStore } from '../server/github-content.mjs';

const ORIGIN = 'https://fephotos.test';
const PASSWORD = 'uma senha de teste longa 123!';
let env;
before(async () => {
  env = { FEPHOTOS_ADMIN_USERNAME: 'felipe', FEPHOTOS_ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD),
    FEPHOTOS_SESSION_SECRET: randomBytes(48).toString('hex'), FEPHOTOS_GITHUB_TOKEN: 'test-only-not-a-real-token' };
});

function request(action, { method, body, cookie, csrf, origin = ORIGIN } = {}) {
  return new Request(`${ORIGIN}/api/admin/${action}`, {
    method: method || (action === 'session' ? 'GET' : 'POST'),
    headers: { Origin: origin, 'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function login(handler) {
  const response = await handler(request('login', { body: { username: 'felipe', password: PASSWORD } }));
  assert.equal(response.status, 200);
  return { cookie: response.headers.get('set-cookie').split(';')[0], user: await response.json() };
}
function noNetwork() { throw new Error('Unexpected GitHub access'); }

test('fails closed without server credentials; no default or demo password', async () => {
  const response = await createAdminHandler({}, { fetchImpl: noNetwork })(request('session'));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
});
test('anonymous requests cannot read or write through the CMS', async () => {
  const handler = createAdminHandler(env, { fetchImpl: noNetwork });
  assert.equal((await handler(request('session'))).status, 401);
  assert.equal((await handler(request('cms', { body: { action: 'getEntry', params: { path: 'content/site.json' } } }))).status, 401);
});
test('there are no signup, invitation, reset, or change-password endpoints', async () => {
  const handler = createAdminHandler(env, { fetchImpl: noNetwork });
  for (const action of ['signup', 'register', 'invite', 'reset', 'forgot-password', 'change-password', 'users']) {
    assert.equal((await handler(request(action, { body: {} }))).status, 404, action);
  }
});
test('wrong password and unknown username have the same failure', async () => {
  const handler = createAdminHandler(env, { fetchImpl: noNetwork });
  const a = await handler(request('login', { body: { username: 'felipe', password: 'wrong' } }));
  const b = await handler(request('login', { body: { username: 'another-user', password: PASSWORD } }));
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(await a.text(), await b.text());
});
test('login creates a secure cookie without exposing password, hash, or GitHub token', async () => {
  const handler = createAdminHandler(env, { fetchImpl: noNetwork });
  const response = await handler(request('login', { body: { username: 'felipe', password: PASSWORD } }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /__Host-fephotos_admin=.*; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400/);
  const body = await response.text();
  assert.ok(!body.includes(PASSWORD));
  assert.ok(!body.includes(env.FEPHOTOS_ADMIN_PASSWORD_HASH));
  assert.ok(!body.includes(env.FEPHOTOS_GITHUB_TOKEN));
});
test('session restore, tampering rejection, and expiration are enforced server-side', async () => {
  let time = Date.now();
  const handler = createAdminHandler(env, { fetchImpl: noNetwork, now: () => time });
  const { cookie } = await login(handler);
  assert.equal((await handler(request('session', { cookie }))).status, 200);
  assert.equal((await handler(request('session', { cookie: `${cookie}x` }))).status, 401);
  time += 4 * 60 * 60 * 1000 + 1;
  assert.equal((await handler(request('session', { cookie }))).status, 401);
});
test('rotating password or session secret invalidates existing sessions', async () => {
  const { cookie } = await login(createAdminHandler(env, { fetchImpl: noNetwork }));
  for (const changes of [{ FEPHOTOS_SESSION_SECRET: randomBytes(48).toString('hex') },
    { FEPHOTOS_ADMIN_PASSWORD_HASH: await hashPassword('outra senha longa de teste 123!') }]) {
    assert.equal((await createAdminHandler({ ...env, ...changes }, { fetchImpl: noNetwork })(request('session', { cookie }))).status, 401);
  }
});
test('cross-origin login and writes are rejected, even with a valid cookie', async () => {
  const handler = createAdminHandler(env, { fetchImpl: noNetwork });
  assert.equal((await handler(request('login', { origin: 'https://evil.test', body: { username: 'felipe', password: PASSWORD } }))).status, 403);
  const { cookie, user } = await login(handler);
  assert.equal((await handler(request('cms', { cookie, body: { action: 'getEntry' } }))).status, 403);
  assert.equal((await handler(request('cms', { cookie, csrf: user.csrf, origin: 'https://evil.test', body: {} }))).status, 403);
});
test('logout clears the secure session cookie and requires CSRF', async () => {
  const handler = createAdminHandler(env, { fetchImpl: noNetwork });
  const { cookie, user } = await login(handler);
  assert.equal((await handler(request('logout', { cookie, body: {} }))).status, 403);
  const response = await handler(request('logout', { cookie, csrf: user.csrf, body: {} }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});
test('content scope prevents editing source, workflows, other branches, or deleting site configuration', async () => {
  const store = createContentStore(env, noNetwork);
  for (const path of ['.github/workflows/deploy-pages.yml', 'static/admin/login.js', 'content/../site.json', 'content/projects/../site.json', 'content/projects/%2e%2e/site.json']) {
    await assert.rejects(store.dispatch({ action: 'getEntry', params: { path } }), { status: 403 });
  }
  await assert.rejects(store.dispatch({ action: 'getEntry', branch: 'another', params: { path: 'content/site.json' } }), { status: 403 });
  await assert.rejects(store.dispatch({ action: 'deleteFiles', params: { paths: ['content/site.json'] } }), { status: 403 });
  await assert.rejects(store.dispatch({ action: 'createUser' }), { status: 400 });
});
test('invalid media, executable uploads, and malformed JSON never reach GitHub', async () => {
  const store = createContentStore(env, noNetwork);
  for (const path of ['static/images/uploads/test.svg', 'static/images/uploads/test.html', 'static/images/uploads/../test.jpg']) {
    await assert.rejects(store.dispatch({ action: 'persistMedia', params: { asset: { path, encoding: 'base64', content: 'aA==' } } }), { status: 403 });
  }
  await assert.rejects(store.dispatch({ action: 'persistMedia', params: { asset: { path: 'static/images/uploads/test.jpg', encoding: 'base64', content: Buffer.from('<script>bad</script>').toString('base64') } } }), { status: 400 });
  await assert.rejects(store.dispatch({ action: 'persistEntry', params: { dataFiles: [{ path: 'content/projects/new.json', raw: 'not json' }], assets: [] } }), { status: 400 });
});

function fakeGithub({ conflict = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.ok(url.startsWith('https://api.github.com/repos/FeBuen0/fephotoportifolio/'));
    assert.equal(options.headers.Authorization, `Bearer ${env.FEPHOTOS_GITHUB_TOKEN}`);
    const path = url.split('fephotoportifolio/')[1];
    const body = options.body && JSON.parse(options.body);
    calls.push({ path, method: options.method, body });
    const reply = path === 'git/ref/heads/main' ? { object: { sha: 'head-sha' } }
      : path === 'git/commits/head-sha' ? { tree: { sha: 'base-tree' } }
      : path === 'git/blobs' ? { sha: `blob-${calls.length}` }
      : path === 'git/trees' ? { sha: 'next-tree' }
      : path === 'git/commits' ? { sha: 'next-commit' }
      : path === 'git/refs/heads/main' ? {} : undefined;
    assert.notEqual(reply, undefined, path);
    return Response.json(reply, { status: path === 'git/refs/heads/main' && conflict ? 422 : 200 });
  };
  return { fetchImpl, calls };
}
test('an authenticated save commits project and photo atomically, then publishes without force', async () => {
  const github = fakeGithub();
  const handler = createAdminHandler(env, { fetchImpl: github.fetchImpl });
  const { cookie, user } = await login(handler);
  const response = await handler(request('cms', { cookie, csrf: user.csrf, body: {
    action: 'persistEntry', branch: 'main', params: {
      dataFiles: [{ path: 'content/projects/novo-ensaio.json', raw: JSON.stringify({ title: 'Novo ensaio' }) }],
      assets: [{ path: 'static/images/uploads/foto.jpg', encoding: 'base64', content: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64') }],
    },
  } }));
  assert.equal(response.status, 200);
  const tree = github.calls.find(x => x.path === 'git/trees').body;
  assert.equal(tree.base_tree, 'base-tree');
  assert.deepEqual(tree.tree.map(x => x.path).sort(), ['content/projects/novo-ensaio.json', 'static/images/uploads/foto.jpg']);
  assert.deepEqual(github.calls.at(-1), { path: 'git/refs/heads/main', method: 'PATCH', body: { sha: 'next-commit', force: false } });
});
test('a concurrent publication is reported as a conflict without force-pushing', async () => {
  const github = fakeGithub({ conflict: true });
  const store = createContentStore(env, github.fetchImpl);
  await assert.rejects(store.dispatch({ action: 'persistEntry', params: {
    dataFiles: [{ path: 'content/projects/novo.json', raw: '{}' }], assets: [],
  } }), { status: 409 });
  assert.equal(github.calls.filter(x => x.path === 'git/refs/heads/main').length, 1);
  assert.equal(github.calls.at(-1).body.force, false);
});
test('reading entries matches Decap proxy contract and media listing avoids downloading originals', async () => {
  const store = createContentStore(env, async url => {
    if (url.includes('contents/content/site.json')) return Response.json({ sha: 'entry', name: 'site.json', content: Buffer.from('{"intro":"teste"}').toString('base64') });
    assert.ok(url.includes('contents/static/images/uploads'));
    return Response.json([{ sha: 'photo', name: 'photo.jpg', path: 'static/images/uploads/photo.jpg', size: 2000000 }]);
  });
  const entry = await store.dispatch({ action: 'getEntry', params: { path: 'content/site.json' } });
  assert.equal(entry.data, '{"intro":"teste"}');
  const files = await store.dispatch({ action: 'getMedia', params: { mediaFolder: 'static/images/uploads' } });
  assert.equal(files[0].url, 'https://raw.githubusercontent.com/FeBuen0/fephotoportifolio/main/static/images/uploads/photo.jpg');
  assert.equal(files[0].content, undefined);
});
