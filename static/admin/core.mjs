export const REPOSITORY = 'FeBuen0/fephotoportifolio';
export const OWNER = 'FeBuen0';
export const BRANCH = 'main';
const ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const entryPattern = /^content\/projects\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/;
const uploadPattern = /^static\/images\/uploads\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:jpg|jpeg|png|webp)$/i;

export function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function fromBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }

export function validateVault(vault) {
  if (!vault || vault.version !== 1 || vault.repository !== REPOSITORY || vault.iterations !== ITERATIONS
    || typeof vault.username !== 'string' || !/^[a-zA-Z0-9_.-]{3,80}$/.test(vault.username)
    || !['salt', 'iv', 'ciphertext'].every(key => typeof vault[key] === 'string' && /^[A-Za-z0-9+/]+=*$/.test(vault[key]) && vault[key].length < 4096)) {
    fail('O arquivo de acesso não é válido para o Fephotos.');
  }
  try {
    if (fromBase64(vault.salt).length !== 16 || fromBase64(vault.iv).length !== 12 || fromBase64(vault.ciphertext).length < 32) throw new Error();
  } catch { fail('O arquivo de acesso está incompleto.'); }
  return vault;
}
function aad(vault) { return encoder.encode(`fephotos:1:${vault.repository}:${vault.username}`); }
async function derive(password, salt, usage) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, [usage]);
}
export async function createVault(username, password, token) {
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(username)) fail('Use de 3 a 80 letras, números, pontos, hífens ou sublinhados no usuário.');
  if (typeof password !== 'string' || password.length < 16 || password.length > 256) fail('Use uma senha de 16 a 256 caracteres.');
  if (typeof token !== 'string' || token.length < 20 || token.length > 1024 || /\s/.test(token)) fail('A chave do GitHub não é válida.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const vault = { version: 1, repository: REPOSITORY, username, iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv) };
  const key = await derive(password, salt, 'encrypt');
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(vault) }, key, encoder.encode(token));
  return { ...vault, ciphertext: toBase64(new Uint8Array(ciphertext)) };
}
export async function unlockVault(input, username, password) {
  const vault = validateVault(input);
  if (username !== vault.username || typeof password !== 'string' || password.length > 256) fail('Usuário ou senha incorretos.', 401);
  try {
    const key = await derive(password, fromBase64(vault.salt), 'decrypt');
    const token = decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(vault.iv), additionalData: aad(vault) }, key, fromBase64(vault.ciphertext)));
    if (token.length < 20 || token.length > 1024) throw new Error();
    return token;
  } catch { fail('Usuário ou senha incorretos.', 401); }
}

export function randomId() { return [...crypto.getRandomValues(new Uint8Array(8))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export function groupPath(title, id = randomId()) {
  const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'grupo';
  return `content/projects/${slug}-${id}.json`;
}
export function newGroup(title, order) {
  return { path: groupPath(title), sha: null, dirty: true, data: {
    title: title.trim(), type: 'Ensaio pessoal', order, isExample: false,
    media: { mode: 'images', images: [] }, description: { challenge: '', role: '', result: '' },
  } };
}
export function validateGroup(group) {
  if (!group || !entryPattern.test(group.path)) fail('Caminho do grupo inválido.');
  const data = group.data;
  if (!data || typeof data.title !== 'string' || !data.title.trim() || data.title.length > 120) fail('Dê um nome ao grupo, com até 120 caracteres.');
  if (!Number.isSafeInteger(data.order) || data.order < 1 || data.order > 10000) fail('A ordem do grupo é inválida.');
  if (data.media?.mode === 'images') {
    if (!Array.isArray(data.media.images) || data.media.images.length < 1 || data.media.images.length > 200) fail(`Adicione pelo menos uma foto ao grupo “${data.title}”.`);
    for (const photo of data.media.images) {
      if (typeof photo.image !== 'string' || !/^\/images\/(?:uploads|portfolio)\/[a-zA-Z0-9_. -]+\.(?:jpe?g|png|webp|avif|gif)$/i.test(photo.image)
        || photo.image.includes('..') || typeof photo.alt !== 'string' || photo.alt.length > 500) fail('Uma das fotos tem dados inválidos.');
    }
  } else if (!['video', 'youtube'].includes(data.media?.mode)) fail('Tipo de grupo inválido.');
  return group;
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; output[index] = await fn(items[index], index); }
  }));
  return output;
}

export class GitHubStore {
  #token;
  #fetch;
  constructor(token, fetchImpl = fetch) { this.#token = token; this.#fetch = fetchImpl; }
  close() { this.#token = ''; }
  async request(path, { method = 'GET', body } = {}) {
    if (!this.#token) fail('Entre novamente para continuar.', 401);
    if (!/^(?:\/user$|\/repos\/FeBuen0\/fephotoportifolio(?:\/|$))/.test(path) || path.includes('..') || path.includes('://')) fail('Endereço não permitido.');
    const response = await this.#fetch(`https://api.github.com${path}`, {
      method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${this.#token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const message = response.status === 401 ? 'A chave de acesso venceu ou foi revogada. Importe um novo acesso.'
        : response.status === 403 ? 'O GitHub não permitiu a operação. Confira a permissão de conteúdo e o limite de requisições.'
        : [409, 422].includes(response.status) ? 'O site foi alterado durante a publicação. Seu rascunho foi mantido; tente publicar novamente.'
        : response.status === 404 ? 'Não foi possível acessar o portfólio com esta chave.' : 'O GitHub não respondeu como esperado. Tente novamente.';
      fail(message, response.status);
    }
    return response.status === 204 ? null : response.json();
  }
  async authenticate() {
    const [user, repo] = await Promise.all([this.request('/user'), this.request(`/repos/${REPOSITORY}`)]);
    if (user.login?.toLowerCase() !== OWNER.toLowerCase() || !repo.permissions?.push) { this.close(); fail('Esta chave não tem acesso de edição ao Fephotos.', 403); }
    return { name: user.login };
  }
  async snapshot() {
    const ref = await this.request(`/repos/${REPOSITORY}/git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const commit = await this.request(`/repos/${REPOSITORY}/git/commits/${head}`);
    const tree = await this.request(`/repos/${REPOSITORY}/git/trees/${commit.tree.sha}?recursive=1`);
    if (tree.truncated) fail('A lista de arquivos ficou grande demais. Entre em contato para ajustar o painel.');
    return { head, tree: commit.tree.sha, files: new Map(tree.tree.map(file => [file.path, file])) };
  }
  async load() {
    const snapshot = await this.snapshot();
    const files = [...snapshot.files.values()].filter(file => file.type === 'blob' && entryPattern.test(file.path));
    const groups = await mapLimit(files, 4, async file => {
      const blob = await this.request(`/repos/${REPOSITORY}/git/blobs/${file.sha}`);
      return { path: file.path, sha: file.sha, dirty: false, data: JSON.parse(decoder.decode(fromBase64(blob.content.replace(/\s/g, '')))) };
    });
    groups.sort((a, b) => a.data.order - b.data.order);
    return { groups, head: snapshot.head };
  }
  async publish(groups, deleted, uploads, onProgress = () => {}) {
    const changed = groups.filter(group => group.dirty).map(validateGroup);
    if (!changed.length && !deleted.length) fail('Não há alterações para publicar.');
    if (changed.length + deleted.length > 200) fail('Publique menos grupos por vez.');
    const current = await this.snapshot();
    // Compare only edited groups. Remote edits to unrelated content are retained in the base tree.
    for (const group of [...changed, ...deleted]) {
      if (!entryPattern.test(group.path)) fail('Grupo inválido.');
      const actual = current.files.get(group.path)?.sha || null;
      if (actual !== group.sha) fail(`O grupo “${group.data?.title || group.path}” foi atualizado em outro lugar. Recarregue os grupos antes de publicar.`, 409);
    }
    const changes = changed.map(group => ({ path: group.path, content: toBase64(encoder.encode(`${JSON.stringify(group.data, null, 2)}\n`)), encoding: 'base64' }));
    const referenced = new Set(changed.flatMap(group => (group.data.media?.images || []).map(photo => `static${photo.image}`)));
    for (const [path, blob] of uploads) {
      if (!referenced.has(path)) continue;
      if (!uploadPattern.test(path) || !(blob instanceof Blob) || blob.size < 1 || blob.size > 3_000_000) fail('Uma das fotos é inválida ou excede 3 MB.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const webp = decoder.decode(bytes.subarray(0, 4)) === 'RIFF' && decoder.decode(bytes.subarray(8, 12)) === 'WEBP';
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
      if (!jpg && !webp && !png) fail('O arquivo enviado não é uma foto válida.');
      if (current.files.has(path)) fail('Uma foto com este nome já existe. Adicione-a novamente.');
      changes.push({ path, content: toBase64(bytes), encoding: 'base64' });
    }
    for (const group of changed) for (const photo of group.data.media?.images || []) {
      const path = `static${photo.image}`;
      if (!current.files.has(path) && !uploads.has(path)) fail('Uma das fotos não foi carregada por completo. Adicione-a novamente.');
    }
    let done = 0;
    const tree = await mapLimit(changes, 3, async change => {
      const blob = await this.request(`/repos/${REPOSITORY}/git/blobs`, { method: 'POST', body: { content: change.content, encoding: change.encoding } });
      onProgress(++done, changes.length);
      return { path: change.path, mode: '100644', type: 'blob', sha: blob.sha };
    });
    tree.push(...deleted.map(group => ({ path: group.path, mode: '100644', type: 'blob', sha: null })));
    const nextTree = await this.request(`/repos/${REPOSITORY}/git/trees`, { method: 'POST', body: { base_tree: current.tree, tree } });
    const commit = await this.request(`/repos/${REPOSITORY}/git/commits`, { method: 'POST', body: {
      message: 'Atualiza fotos e grupos pelo painel Fephotos', tree: nextTree.sha, parents: [current.head],
    } });
    await this.request(`/repos/${REPOSITORY}/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
    return { sha: commit.sha, files: Object.fromEntries(tree.filter(file => file.sha).map(file => [file.path, file.sha])) };
  }
}
