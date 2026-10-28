// Compare the built public files, rather than treating an Actions result as proof
// that the visitor's site is already serving these edits.
export function matchesPublication(manifest, expected) {
  if (manifest?.version !== 1 || !manifest.projects || typeof manifest.projects !== 'object') return false;
  const files = Object.entries(expected.files || {}).filter(([path]) => path.startsWith('content/projects/'));
  const deleted = expected.deleted || [];
  if (!files.length && !deleted.length) return false;
  return files.every(([path, sha]) => manifest.projects[path] === sha)
    && deleted.every(path => !Object.hasOwn(manifest.projects, path));
}

export async function checkLivePublication(expected, { basePath = '', fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl.call(globalThis, `${basePath}/data/publication.json?v=${Date.now()}`, {
    credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  return response.ok && matchesPublication(await response.json(), expected);
}
