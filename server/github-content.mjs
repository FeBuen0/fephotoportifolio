const REPO = 'FeBuen0/fephotoportifolio';
const BRANCH = 'main';
const MAX_MEDIA = 3_000_000;
const mediaPattern = /^static\/images\/(?:uploads|portfolio)\/[a-zA-Z0-9][a-zA-Z0-9_ .-]*\.(?:jpe?g|png|webp|gif|avif|mp4)$/i;
const entryPattern = /^(?:content\/site\.json|content\/projects\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.json)$/;

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function validPath(path, kind = 'entry') {
  if (typeof path !== 'string' || path.length > 240 || path.includes('..')
    || !(kind === 'entry' ? entryPattern : mediaPattern).test(path)) fail(403, 'Este arquivo não pode ser alterado pelo painel.');
  return path;
}
function folderPath(folder) {
  if (!['static/images/uploads', 'static/images/portfolio'].includes(folder)) fail(403, 'Pasta não permitida.');
  return folder;
}
function base64(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_MEDIA / 3) * 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail(413, 'O arquivo deve ter até 3 MB.');
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.length > MAX_MEDIA) fail(413, 'O arquivo deve ter até 3 MB.');
  return bytes;
}
function mediaBytes(asset) {
  const path = validPath(asset?.path, 'media');
  if (asset.encoding !== 'base64') fail(400, 'Arquivo inválido.');
  const bytes = base64(asset.content);
  const extension = path.split('.').pop().toLowerCase();
  const header = bytes.subarray(0, 16);
  const valid = /^jpe?g$/.test(extension) ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : extension === 'png' ? header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : extension === 'gif' ? /^GIF8[79]a/.test(header.toString('ascii'))
    : extension === 'webp' ? header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
    : extension === 'avif' ? header.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(header.toString('ascii', 8, 12))
    : extension === 'mp4' && header.toString('ascii', 4, 8) === 'ftyp';
  if (!valid) fail(400, 'O conteúdo não corresponde ao formato do arquivo.');
  return { path, content: bytes.toString('base64'), encoding: 'base64' };
}

export function createContentStore(env, fetchImpl) {
  async function github(path, method = 'GET', body) {
    const response = await fetchImpl(`https://api.github.com/repos/${REPO}/${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${env.FEPHOTOS_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'Fephotos-admin' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 404) fail(404, 'Arquivo não encontrado.');
    if ([409, 422].includes(response.status)) fail(409, 'O conteúdo mudou durante a edição. Atualize o painel e tente novamente.');
    if (!response.ok) fail(502, 'Não foi possível acessar o conteúdo.');
    return response.status === 204 ? null : response.json();
  }
  function contentPath(path) { return `contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${BRANCH}`; }
  async function readEntry(path) {
    validPath(path);
    const data = await github(contentPath(path));
    return { file: { id: data.sha, name: data.name, path }, data: Buffer.from(data.content, 'base64').toString('utf8') };
  }
  async function readMedia(path) {
    validPath(path, 'media');
    const data = await github(contentPath(path));
    return { id: data.sha, name: data.name, path, content: data.content.replace(/\s/g, ''), encoding: 'base64' };
  }
  async function list(folder) {
    try { const data = await github(contentPath(folder)); return Array.isArray(data) ? data : []; }
    catch (error) { if (error.status === 404) return []; throw error; }
  }
  async function commit(changes) {
    if (!changes.length || changes.length > 50 || new Set(changes.map(x => x.path)).size !== changes.length) fail(400, 'Quantidade de arquivos inválida.');
    // Commit all content and uploaded assets together; never overwrite the branch on a conflict.
    const ref = await github(`git/ref/heads/${BRANCH}`);
    const parent = await github(`git/commits/${ref.object.sha}`);
    const tree = await Promise.all(changes.map(async change => {
      const sha = change.remove ? null : (await github('git/blobs', 'POST', { content: change.content, encoding: change.encoding })).sha;
      return { path: change.path, mode: '100644', type: 'blob', sha };
    }));
    const nextTree = await github('git/trees', 'POST', { base_tree: parent.tree.sha, tree });
    const nextCommit = await github('git/commits', 'POST', { message: 'Atualiza conteúdo pelo painel Fephotos', tree: nextTree.sha, parents: [ref.object.sha] });
    await github(`git/refs/heads/${BRANCH}`, 'PATCH', { sha: nextCommit.sha, force: false });
  }
  return {
    async dispatch({ action, params = {}, branch }) {
      if (typeof action !== 'string' || !params || typeof params !== 'object' || Array.isArray(params)) fail(400, 'Envio inválido.');
      if (branch && branch !== BRANCH || params.branch && params.branch !== BRANCH) fail(403, 'Branch não permitida.');
      switch (action) {
        case 'entriesByFolder': {
          if (params.folder !== 'content/projects' || params.extension !== 'json') fail(403, 'Pasta não permitida.');
          const files = (await list(params.folder)).filter(x => entryPattern.test(x.path));
          return Promise.all(files.map(x => readEntry(x.path)));
        }
        case 'entriesByFiles': {
          if (!Array.isArray(params.files) || params.files.length > 50) fail(400, 'Arquivos inválidos.');
          params.files.forEach(x => validPath(x?.path || x?.file));
          return Promise.all(params.files.map(x => readEntry(x.path || x.file)));
        }
        case 'getEntry': return readEntry(params.path);
        case 'getMedia': {
          const files = (await list(folderPath(params.mediaFolder))).filter(x => mediaPattern.test(x.path));
          // Thumbnails use the public repository. Listing never downloads all originals into a function response.
          return files.map(file => ({ id: file.sha, name: file.name, path: file.path, size: file.size,
            url: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${file.path.split('/').map(encodeURIComponent).join('/')}` }));
        }
        case 'getMediaFile': return readMedia(params.path);
        case 'persistMedia': {
          const asset = mediaBytes(params.asset);
          await commit([asset]);
          return { ...asset, id: asset.path, name: asset.path.split('/').pop() };
        }
        case 'persistEntry': {
          if (!Array.isArray(params.dataFiles) || !params.dataFiles.length || params.dataFiles.length > 20
            || !Array.isArray(params.assets) || params.assets.length > 30) fail(400, 'Projeto inválido.');
          const files = params.dataFiles.map(file => {
            validPath(file?.path);
            if (typeof file.raw !== 'string' || Buffer.byteLength(file.raw) > 128000) fail(400, 'Conteúdo inválido.');
            try { const data = JSON.parse(file.raw); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); }
            catch { fail(400, 'O conteúdo do projeto precisa ser JSON válido.'); }
            return { path: file.path, content: file.raw, encoding: 'utf-8' };
          });
          const assets = params.assets.map(mediaBytes);
          await commit([...files, ...assets]);
          return null;
        }
        case 'deleteFiles': {
          if (!Array.isArray(params.paths) || !params.paths.length || params.paths.length > 50) fail(400, 'Arquivos inválidos.');
          const files = params.paths.map(path => {
            if (path === 'content/site.json') fail(403, 'As configurações do site não podem ser excluídas.');
            validPath(path, typeof path === 'string' && path.startsWith('content/') ? 'entry' : 'media');
            return { path, remove: true };
          });
          await commit(files);
          return null;
        }
        case 'getDeployPreview': return null;
        case 'getNotes': return { notes: [] };
        case 'getPRMetadata': return { metadata: null };
        default: fail(400, 'Operação não permitida.');
      }
    },
  };
}
