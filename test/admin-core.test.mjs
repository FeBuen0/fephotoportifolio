import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVault, unlockVault, validateVault, GitHubStore, newGroup, validateGroup, REPOSITORY } from '../static/admin/core.mjs';
const PASSWORD = 'frase longa apenas para teste 123';
const TOKEN = 'github_pat_fake_unit_test_1234567890';

test('vault has no plaintext token or password and can only be opened with the correct credentials', async () => {
  const vault = await createVault('felipe', PASSWORD, TOKEN);
  const raw = JSON.stringify(vault);
  assert.ok(!raw.includes(TOKEN)); assert.ok(!raw.includes(PASSWORD));
  assert.equal(await unlockVault(vault, 'felipe', PASSWORD), TOKEN);
  await assert.rejects(unlockVault(vault, 'felipe', 'senha incorreta'), { status: 401 });
  await assert.rejects(unlockVault(vault, 'outro', PASSWORD), { status: 401 });
});
test('changing the vault, username, repository, or cryptographic parameters invalidates access', async () => {
  const vault = await createVault('felipe', PASSWORD, TOKEN);
  const changed = { ...vault, ciphertext: (vault.ciphertext.startsWith('A') ? 'B' : 'A') + vault.ciphertext.slice(1) };
  await assert.rejects(unlockVault(changed, 'felipe', PASSWORD), { status: 401 });
  await assert.rejects(unlockVault({ ...vault, username: 'another' }, 'another', PASSWORD), { status: 401 });
  assert.throws(() => validateVault({ ...vault, repository: 'another/repo' }));
  assert.throws(() => validateVault({ ...vault, iterations: 1 }));
});
test('access provisioning enforces a long password and produces independent salts and IVs', async () => {
  await assert.rejects(createVault('felipe', '123', TOKEN));
  const a = await createVault('felipe', PASSWORD, TOKEN); const b = await createVault('felipe', PASSWORD, TOKEN);
  assert.notEqual(a.salt, b.salt); assert.notEqual(a.iv, b.iv); assert.notEqual(a.ciphertext, b.ciphertext);
});
test('group creation keeps the current public portfolio schema and validates photos', () => {
  const group = newGroup('Viagem ao Pantanal', 8);
  assert.match(group.path, /^content\/projects\/viagem-ao-pantanal-[a-f0-9]+\.json$/);
  assert.throws(() => validateGroup(group), /pelo menos uma foto/);
  group.data.media.images.push({ image: '/images/uploads/foto.webp', alt: 'Arara no Pantanal' });
  assert.equal(validateGroup(group), group);
  group.path = 'static/admin/app.mjs'; assert.throws(() => validateGroup(group));
});

function fakeGithub({ sameGroupChanged = false, race = false, user = 'FeBuen0', push = true } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url); const path = parsed.pathname; const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, method: options.method, body });
    assert.equal(parsed.origin, 'https://api.github.com');
    assert.equal(options.headers.Authorization, `Bearer ${TOKEN}`);
    assert.ok(!options.body?.includes(TOKEN));
    let data;
    if (path === '/user') data = { login: user };
    else if (path === `/repos/${REPOSITORY}`) data = { permissions: { push } };
    else if (path.endsWith('/git/ref/heads/main')) data = { object: { sha: 'latest-head' } };
    else if (path.endsWith('/git/commits/latest-head')) data = { tree: { sha: 'latest-tree' } };
    else if (path.endsWith('/git/trees/latest-tree')) data = { sha: 'latest-tree', tree: [
      { path: 'content/projects/automotiva.json', type: 'blob', sha: sameGroupChanged ? 'remote-edit' : 'original-sha' },
      { path: 'content/projects/untouched.json', type: 'blob', sha: 'unrelated-remote-edit' },
      { path: 'static/images/portfolio/foto.jpg', type: 'blob', sha: 'photo' },
    ] };
    else if (path.endsWith('/git/blobs')) data = { sha: `new-blob-${calls.length}` };
    else if (path.endsWith('/git/trees')) data = { sha: 'next-tree' };
    else if (path.endsWith('/git/commits')) data = { sha: 'next-commit' };
    else if (path.endsWith('/git/refs/heads/main')) return Response.json({}, { status: race ? 422 : 200 });
    else assert.fail(`Unexpected endpoint: ${path}`);
    return Response.json(data);
  };
  return { store: new GitHubStore(TOKEN, fetchImpl), calls };
}
function editedGroup() {
  return { path: 'content/projects/automotiva.json', sha: 'original-sha', dirty: true,
    data: { title: 'Automotiva', type: 'Ensaio pessoal', order: 4, isExample: false,
      media: { mode: 'images', images: [{ image: '/images/portfolio/foto.jpg', alt: 'Carro' }] }, description: { challenge: '', role: '', result: '' } } };
}
test('only the expected GitHub account with repository write access is accepted', async () => {
  assert.equal((await fakeGithub().store.authenticate()).name, 'FeBuen0');
  await assert.rejects(fakeGithub({ user: 'someone-else' }).store.authenticate(), { status: 403 });
  await assert.rejects(fakeGithub({ push: false }).store.authenticate(), { status: 403 });
});
test('credential requests are restricted to GitHub and the fixed repository', async () => {
  const client = fakeGithub().store;
  await assert.rejects(client.request('/repos/another/repo'), /Endereço não permitido/);
  await assert.rejects(client.request('https://evil.test'), /Endereço não permitido/);
  client.close(); await assert.rejects(client.request('/user'), { status: 401 });
});
test('publishing preserves remote changes to other groups and does not force-push', async () => {
  const { store, calls } = fakeGithub();
  const result = await store.publish([editedGroup()], [], new Map());
  assert.equal(result.sha, 'next-commit'); assert.ok(result.files['content/projects/automotiva.json']);
  const tree = calls.find(call => call.path.endsWith('/git/trees') && call.method === 'POST').body;
  assert.equal(tree.base_tree, 'latest-tree'); assert.equal(tree.tree.length, 1);
  assert.equal(tree.tree[0].path, 'content/projects/automotiva.json');
  assert.deepEqual(calls.at(-1).body, { sha: 'next-commit', force: false });
});
test('a conflict in the same group stops before uploading or committing any file', async () => {
  const { store, calls } = fakeGithub({ sameGroupChanged: true });
  await assert.rejects(store.publish([editedGroup()], [], new Map()), { status: 409 });
  assert.ok(calls.every(call => call.method === 'GET'));
});
test('a concurrent branch update is surfaced without force-pushing or deleting the local draft', async () => {
  const { store, calls } = fakeGithub({ race: true }); const group = editedGroup();
  await assert.rejects(store.publish([group], [], new Map()), { status: 422 });
  assert.equal(group.dirty, true); assert.equal(group.sha, 'original-sha');
  assert.equal(calls.at(-1).body.force, false);
});
test('new photo and group are published in one tree; unrelated pending uploads are omitted', async () => {
  const { store, calls } = fakeGithub(); const group = editedGroup();
  group.data.media.images.push({ image: '/images/uploads/new.jpg', alt: 'Nova foto' });
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  await store.publish([group], [], new Map([['static/images/uploads/new.jpg', jpeg], ['static/images/uploads/not-used.jpg', jpeg]]));
  const tree = calls.find(call => call.path.endsWith('/git/trees') && call.method === 'POST').body;
  assert.deepEqual(tree.tree.map(item => item.path).sort(), ['content/projects/automotiva.json', 'static/images/uploads/new.jpg']);
});
test('deleting a group deletes only its JSON reference, leaving original photos intact', async () => {
  const { store, calls } = fakeGithub(); const group = editedGroup();
  await store.publish([], [group], new Map());
  const tree = calls.find(call => call.path.endsWith('/git/trees') && call.method === 'POST').body;
  assert.deepEqual(tree.tree, [{ path: group.path, type: 'blob', mode: '100644', sha: null }]);
});
test('invalid uploads and a missing photo are rejected before a commit is created', async () => {
  const { store, calls } = fakeGithub(); const group = editedGroup();
  group.data.media.images.push({ image: '/images/uploads/new.jpg', alt: 'Foto' });
  await assert.rejects(store.publish([group], [], new Map()), /não foi carregada/);
  await assert.rejects(store.publish([group], [], new Map([['static/images/uploads/new.jpg', new Blob(['<script>bad</script>'])]])), /foto válida/);
  assert.ok(!calls.some(call => call.path.endsWith('/git/commits') && call.method === 'POST'));
});
