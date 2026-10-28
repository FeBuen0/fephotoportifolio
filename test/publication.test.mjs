import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesPublication, checkLivePublication } from '../static/admin/publication.mjs';

const path = 'content/projects/ensaio.json';
const deleted = 'content/projects/excluido.json';
const expected = { sha: 'new-commit', files: { [path]: 'new-photo-group', 'static/images/uploads/photo.webp': 'photo' }, deleted: [deleted] };

test('an old public build cannot confirm publication even when Actions succeeded', () => {
  assert.equal(matchesPublication({ version: 1, commit: 'old-commit', projects: { [path]: 'old-photo-group' } }, expected), false);
  assert.equal(matchesPublication(null, expected), false);
  assert.equal(matchesPublication({ version: 1, projects: {} }, expected), false);
});

test('confirms edited groups only after the public build contains their exact files and removals', () => {
  assert.equal(matchesPublication({ version: 1, projects: { [path]: 'new-photo-group' } }, expected), true);
  assert.equal(matchesPublication({ version: 1, projects: { [path]: 'new-photo-group', [deleted]: 'still-there' } }, expected), false);
  // A newer deployment can also contain the user's completed publication.
  assert.equal(matchesPublication({ version: 1, commit: 'later-commit', projects: { [path]: 'new-photo-group' } }, expected), true);
  assert.equal(matchesPublication({ version: 1, projects: {} }, { files: {}, deleted: [deleted] }), true);
  assert.equal(matchesPublication({ version: 1, projects: {} }, { files: {}, deleted: [] }), false);
});

test('checks the public domain without cached JSON or GitHub credentials, including the Pages base path', async () => {
  let calls = 0;
  async function browserFetch(url, options) {
    assert.equal(this, globalThis);
    assert.match(url, /^\/fephotoportifolio\/data\/publication\.json\?v=\d+$/);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    calls++;
    return Response.json({ version: 1, projects: { [path]: 'new-photo-group' } });
  }
  assert.equal(await checkLivePublication(expected, { basePath: '/fephotoportifolio', fetchImpl: browserFetch }), true);
  assert.equal(calls, 1);
  assert.equal(await checkLivePublication(expected, { fetchImpl: async () => new Response('', { status: 404 }) }), false);
});
