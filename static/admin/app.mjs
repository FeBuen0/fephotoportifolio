import { GitHubStore, REPOSITORY, createVault, unlockVault, validateVault, newGroup, randomId } from './core.mjs?v=github-fetch-3';
import { ADMIN_USERNAME, verifyLogin } from './login.mjs?v=acesso-direto-2';
import { readDraft, saveDraft, clearDraft } from './drafts.mjs';
import { checkLivePublication } from './publication.mjs?v=publicacao-4';

const $ = selector => document.querySelector(selector);
const ACCESS_KEY = 'fephotos.admin.access.v1';
const basePath = location.hostname === 'febuen0.github.io' ? '/fephotoportifolio' : '';
let vault;
let connectionPassword = '';
let connectionTimer;
let store;
let groups = [];
let deleted = [];
let uploads = new Map();
let selected = '';
let processing = false;
let publishing = false;
let draftTimer;
let idleTimer;
let absoluteTimer;
let memoryOnly = false;
let draftSaving = false;
let saveSequence = Promise.resolve();
let publishGeneration = 0;
let publication = null;
let draggedPhoto = null;
const objectURLs = new Map();

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
if (window.top !== window.self) {
  const message = node('p', 'notice', 'Abra o painel diretamente em fephotos.com.br/admin/ para entrar.');
  document.body.replaceChildren(message);
  throw new Error('O painel não permite acesso dentro de outra página.');
}
function active() { return groups.find(group => group.path === selected); }
function dirtyCount() { return groups.filter(group => group.dirty).length + deleted.length; }
function photoList(group) { return group?.data.media?.mode === 'images' ? group.data.media.images : []; }
function imageURL(path) {
  const source = `static${path}`;
  if (objectURLs.has(source)) return objectURLs.get(source);
  if (uploads.has(source)) {
    const url = URL.createObjectURL(uploads.get(source));
    objectURLs.set(source, url);
    return url;
  }
  return path?.startsWith('/images/') ? `${basePath}${path}` : '';
}
function notice(text, error = false) {
  $('#notice').replaceChildren(document.createTextNode(text));
  $('#notice').classList.toggle('error', error);
  $('#notice').hidden = !text;
}
function updateStatus(message) {
  const count = dirtyCount();
  $('#draft-status').textContent = processing ? 'Preparando fotos…' : publishing ? 'Publicando…'
    : count ? `${count} ${count === 1 ? 'grupo com alterações' : 'grupos com alterações'}`
    : publication?.phase === 'waiting' ? 'Atualizando o site…'
    : publication?.phase === 'success' ? 'Publicado no site'
    : publication?.phase === 'error' ? 'Publicação não concluída'
    : publication?.phase === 'pending' ? 'Publicação ainda não confirmada' : 'Sem alterações pendentes';
  if (message) $('#publish-status').textContent = message;
  else if (!publishing) $('#publish-status').textContent = count ? memoryOnly ? 'Rascunho só nesta aba. Mantenha-a aberta até publicar.' : draftSaving ? 'Salvando rascunho neste navegador…' : 'Rascunho salvo apenas neste navegador.'
    : publication?.message || 'Adicione ou edite fotos e grupos para publicar.';
  $('#publish').disabled = !count || publishing || processing;
  $('#publish').textContent = publishing ? 'Enviando…' : count ? 'Publicar no site'
    : publication?.phase === 'waiting' ? 'Atualizando site…' : publication?.phase === 'success' ? 'Publicado' : 'Sem alterações';
  $('#view-publication').hidden = !!count || publication?.phase !== 'success';
  if (publication?.phase === 'success') $('#view-publication').href = `../trabalhos/?v=${publication.sha}`;
  $('#choose-photos').disabled = processing || publishing;
}
function draftValue() { return { version: 1, groups, deleted, uploads: [...uploads], selected, savedAt: Date.now() }; }
async function persistDraft() {
  clearTimeout(draftTimer);
  draftSaving = true;
  const value = structuredClone(draftValue());
  saveSequence = saveSequence.catch(() => {}).then(() => saveDraft(value)).catch(() => {
    memoryOnly = true;
    updateStatus();
  });
  await saveSequence;
  draftSaving = false;
}
function changed(group, { sidebar = false } = {}) {
  if (group) group.dirty = true;
  draftSaving = true;
  if (sidebar) renderSidebar();
  updateStatus('Salvando rascunho neste navegador…');
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => persistDraft().then(() => updateStatus()), 300);
}
function renumber() {
  groups.forEach((group, index) => {
    if (group.data.order !== index + 1) { group.data.order = index + 1; group.dirty = true; }
  });
}
function iconButton(symbol, label, click, className = '') {
  const button = node('button', `square-button ${className}`, symbol);
  button.type = 'button'; button.setAttribute('aria-label', label); button.title = label;
  button.addEventListener('click', click);
  return button;
}
function renderSidebar() {
  $('#group-count').textContent = String(groups.length);
  const fragment = document.createDocumentFragment();
  for (const group of groups) {
    const button = node('button', `group-item${group.path === selected ? ' active' : ''}`);
    button.type = 'button';
    if (group.path === selected) button.setAttribute('aria-current', 'true');
    const coverPath = photoList(group)[0]?.image || group.data.media?.poster;
    if (coverPath && imageURL(coverPath)) {
      const image = node('img', 'group-cover'); image.src = imageURL(coverPath); image.alt = ''; image.loading = 'lazy'; button.append(image);
    } else button.append(node('span', 'group-cover cover-empty', group.data.media?.mode === 'images' ? '+' : '▶'));
    const label = node('span', 'group-label');
    const total = photoList(group).length;
    label.append(node('strong', '', group.data.title || 'Grupo sem nome'), node('small', '', group.data.media?.mode === 'images' ? `${total} ${total === 1 ? 'foto' : 'fotos'}` : 'Vídeo'));
    button.append(label);
    if (group.dirty) button.append(node('span', 'dirty-dot'));
    button.addEventListener('click', () => { selected = group.path; render(); window.scrollTo({ top: 0, behavior: 'auto' }); });
    fragment.append(button);
  }
  $('#group-list').replaceChildren(fragment);
}
function selectGroup(path) { selected = path; render(); }
function movePhoto(group, index, next) {
  const photos = photoList(group);
  if (index === next || next < 0 || next >= photos.length || publishing) return;
  const [photo] = photos.splice(index, 1); photos.splice(next, 0, photo);
  changed(group, { sidebar: true }); renderPhotos();
}
function renderPhotos() {
  const group = active();
  const photos = photoList(group);
  $('#photo-count').textContent = String(photos.length);
  $('#empty-photos').hidden = photos.length > 0;
  const fragment = document.createDocumentFragment();
  photos.forEach((photo, index) => {
    const card = node('article', 'photo-card'); card.draggable = true;
    const image = node('img'); image.src = imageURL(photo.image); image.alt = photo.alt || `Foto ${index + 1}`; image.loading = 'lazy'; image.draggable = false;
    card.append(image, node('span', 'photo-tag', index === 0 ? 'CAPA' : String(index + 1).padStart(2, '0')));
    const body = node('div', 'photo-card-body');
    const label = node('label', '', 'Descrição da imagem');
    const input = node('input'); input.value = photo.alt || ''; input.maxLength = 500; input.id = `alt-${index}`; label.htmlFor = input.id;
    input.addEventListener('input', () => { photo.alt = input.value; changed(group); });
    body.append(label, input);
    const controls = node('div', 'photo-controls');
    const up = iconButton('←', `Mover foto ${index + 1} para antes`, () => movePhoto(group, index, index - 1)); up.disabled = index === 0;
    const down = iconButton('→', `Mover foto ${index + 1} para depois`, () => movePhoto(group, index, index + 1)); down.disabled = index === photos.length - 1;
    const remove = iconButton('×', `Remover foto ${index + 1} deste grupo`, () => {
      photos.splice(index, 1); changed(group, { sidebar: true }); renderPhotos();
      notice('Foto retirada do grupo. A mudança só vai ao ar ao publicar. O arquivo original não é apagado.');
    }, 'remove-photo');
    controls.append(up, down, remove); body.append(controls);
    if (index > 0) {
      const cover = node('button', 'cover-button', 'Usar como capa'); cover.type = 'button';
      cover.setAttribute('aria-label', `Usar foto ${index + 1} como capa`); cover.addEventListener('click', () => movePhoto(group, index, 0)); body.append(cover);
    }
    const targets = groups.filter(other => other !== group && other.data.media?.mode === 'images');
    if (targets.length) {
      const select = node('select'); select.setAttribute('aria-label', `Mover foto ${index + 1} para outro grupo`);
      const placeholder = node('option', '', 'Mover para outro grupo…'); placeholder.value = ''; select.append(placeholder);
      for (const target of targets) { const option = node('option', '', target.data.title || 'Grupo sem nome'); option.value = target.path; select.append(option); }
      select.addEventListener('change', () => {
        const target = groups.find(other => other.path === select.value);
        if (!target || photoList(target).length >= 200) { notice('O grupo de destino atingiu o limite de 200 fotos.', true); return; }
        photos.splice(index, 1); target.data.media.images.push(photo); target.dirty = true;
        changed(group, { sidebar: true }); renderPhotos(); notice(`Foto movida para “${target.data.title}”.`);
      });
      body.append(select);
    }
    card.append(body);
    card.addEventListener('dragstart', event => {
      if (event.target.closest('input, select, button') || publishing) { event.preventDefault(); return; }
      draggedPhoto = { group: group.path, index }; card.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index));
    });
    card.addEventListener('dragend', () => { draggedPhoto = null; card.classList.remove('dragging'); document.querySelectorAll('.drag-target').forEach(item => item.classList.remove('drag-target')); });
    card.addEventListener('dragover', event => { if (draggedPhoto?.group === group.path) { event.preventDefault(); card.classList.add('drag-target'); } });
    card.addEventListener('dragleave', () => card.classList.remove('drag-target'));
    card.addEventListener('drop', event => {
      if (draggedPhoto?.group !== group.path) return;
      event.preventDefault(); const previous = draggedPhoto.index; draggedPhoto = null; movePhoto(group, previous, index);
    });
    fragment.append(card);
  });
  $('#photo-grid').replaceChildren(fragment);
}
function render() {
  renderSidebar();
  if (!processing) $('#upload-progress').textContent = 'As fotos são otimizadas para o site. Os arquivos originais ficam no seu computador.';
  const group = active();
  $('#empty-editor').hidden = !!group;
  $('#group-editor').hidden = !group;
  if (group) {
    $('#group-heading').textContent = group.data.title || 'Grupo sem nome';
    $('#group-name').value = group.data.title;
    const category = $('#group-category');
    if (![...category.options].some(option => option.value === group.data.type)) category.append(new Option(group.data.type, group.data.type));
    category.value = group.data.type;
    for (const key of ['challenge', 'role', 'result']) $(`#${key}`).value = group.data.description?.[key] || '';
    $('#group-up').disabled = groups.indexOf(group) === 0;
    $('#group-down').disabled = groups.indexOf(group) === groups.length - 1;
    const images = group.data.media?.mode === 'images';
    $('#photo-section').hidden = !images;
    $('#video-note').hidden = images;
    if (images) renderPhotos();
  }
  updateStatus();
}

async function confirmAction(title, text, label = 'Confirmar') {
  $('#confirm-title').textContent = title; $('#confirm-message').textContent = text; $('#confirm-button').textContent = label;
  const dialog = $('#confirm-dialog'); dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
function showNewGroup() {
  $('#new-group-name').value = ''; $('#new-group-dialog').showModal(); $('#new-group-name').focus();
}
$('#new-group').addEventListener('click', showNewGroup);
$('#empty-new-group').addEventListener('click', showNewGroup);
$('#cancel-new-group').addEventListener('click', () => $('#new-group-dialog').close());
$('#new-group-form').addEventListener('submit', event => {
  event.preventDefault();
  const title = $('#new-group-name').value.trim();
  if (!title) return;
  const group = newGroup(title, groups.length + 1); groups.push(group); selected = group.path;
  $('#new-group-dialog').close(); changed(group); render(); window.scrollTo({ top: 0, behavior: 'auto' }); $('#group-name').focus({ preventScroll: true });
});
$('#group-name').addEventListener('input', event => {
  const group = active(); if (!group) return; group.data.title = event.target.value; $('#group-heading').textContent = event.target.value || 'Grupo sem nome'; changed(group, { sidebar: true });
});
$('#group-category').addEventListener('change', event => { const group = active(); group.data.type = event.target.value; changed(group); });
for (const key of ['challenge', 'role', 'result']) $(`#${key}`).addEventListener('input', event => {
  const group = active(); group.data.description ||= {}; group.data.description[key] = event.target.value; changed(group);
});
for (const [id, offset] of [['group-up', -1], ['group-down', 1]]) $(`#${id}`).addEventListener('click', () => {
  const group = active(); const index = groups.indexOf(group); const next = index + offset;
  if (next < 0 || next >= groups.length) return;
  groups.splice(index, 1); groups.splice(next, 0, group); renumber(); changed(); render();
});
$('#delete-group').addEventListener('click', async () => {
  const group = active();
  if (!await confirmAction('Excluir este grupo?', `“${group.data.title}” sairá do portfólio quando você publicar. Os arquivos das fotos não serão apagados.`, 'Excluir grupo')) return;
  const index = groups.indexOf(group); groups.splice(index, 1);
  if (group.sha) deleted.push(group);
  selected = groups[Math.min(index, groups.length - 1)]?.path || ''; renumber(); changed(); render();
});

async function optimisePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(`“${file.name}” não é JPG, PNG ou WebP.`);
  if (file.size > 30_000_000) throw new Error(`“${file.name}” é muito grande. Exporte uma cópia com até 30 MB.`);
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`Não foi possível abrir “${file.name}”.`); }
  try {
    if (bitmap.width * bitmap.height > 80000000) throw new Error(`“${file.name}” tem resolução muito alta. Exporte uma cópia menor.`);
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .87));
    if (!blob || blob.size > 3_000_000) throw new Error(`Não foi possível otimizar “${file.name}”. Exporte uma versão menor.`);
    return blob;
  } finally { bitmap.close(); }
}
async function addFiles(files) {
  const group = active();
  if (!group || group.data.media?.mode !== 'images' || publishing || processing) return;
  const list = [...files];
  if (!list.length) return;
  if (photoList(group).length + list.length > 200) { notice('Cada grupo pode ter até 200 fotos. Selecione menos arquivos.', true); return; }
  processing = true; updateStatus(); $('#logout').disabled = true;
  const errors = []; let added = 0;
  for (let index = 0; index < list.length; index++) {
    $('#upload-progress').textContent = `Preparando foto ${index + 1} de ${list.length}…`;
    try {
      const blob = await optimisePhoto(list[index]);
      const extension = blob.type === 'image/webp' ? 'webp' : 'png';
      const path = `static/images/uploads/foto-${Date.now()}-${randomId()}.${extension}`;
      uploads.set(path, blob);
      group.data.media.images.push({ image: path.slice(6), alt: list[index].name.replace(/\.[^.]+$/, '').slice(0, 500) }); group.dirty = true; added++;
    } catch (error) { errors.push(error.message); }
  }
  processing = false; $('#logout').disabled = false; changed(group); await persistDraft(); render();
  $('#upload-progress').textContent = added ? `${added} ${added === 1 ? 'foto adicionada' : 'fotos adicionadas'}. Os arquivos originais foram preservados.` : 'Nenhuma foto foi adicionada.';
  if (errors.length) notice(errors.join(' '), true);
  else notice(`${added} ${added === 1 ? 'foto pronta' : 'fotos prontas'} em “${group.data.title}”. Clique em Publicar no site para colocá-las no ar.`);
}
$('#choose-photos').addEventListener('click', () => $('#photo-files').click());
$('#photo-files').addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; addFiles(files); });
for (const type of ['dragover', 'dragenter']) $('#dropzone').addEventListener(type, event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); $('#dropzone').classList.add('drag-over'); } });
$('#dropzone').addEventListener('dragleave', event => { if (!$('#dropzone').contains(event.relatedTarget)) $('#dropzone').classList.remove('drag-over'); });
$('#dropzone').addEventListener('drop', event => { event.preventDefault(); $('#dropzone').classList.remove('drag-over'); addFiles(event.dataTransfer.files); });

function resetIdle() {
  if (!store) return;
  clearTimeout(idleTimer); idleTimer = setTimeout(() => lock('A sessão foi bloqueada por inatividade. Entre novamente.'), 20 * 60 * 1000);
}
for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, resetIdle, { passive: true });
async function lock(text = '') {
  if (publishing || processing) { resetIdle(); return; }
  if (dirtyCount()) await persistDraft();
  store?.close(); store = null; clearTimeout(idleTimer); clearTimeout(absoluteTimer); publishGeneration++;
  clearConnection();
  $('#editor').hidden = true; $('#login-screen').hidden = false; $('#password').value = '';
  $('#login-message').textContent = text; $('#login-submit').disabled = false; $('#login-submit').textContent = 'Entrar';
  for (const url of objectURLs.values()) URL.revokeObjectURL(url); objectURLs.clear();
}
$('#logout').addEventListener('click', () => lock());

function clearConnection() {
  connectionPassword = ''; clearTimeout(connectionTimer);
  $('#github-key').value = '';
  $('#connect-publication').hidden = true; $('#login-content').hidden = false;
}
function connectionTimeout() {
  clearTimeout(connectionTimer);
  connectionTimer = setTimeout(() => {
    clearConnection(); $('#login-message').textContent = 'Entre novamente para continuar a conexão.';
  }, 15 * 60 * 1000);
}
function showConnection(password) {
  connectionPassword = password;
  $('#login-content').hidden = true; $('#connect-publication').hidden = false;
  $('#connect-message').textContent = ''; $('#github-key').value = ''; $('#github-key').focus();
  connectionTimeout();
}
$('#cancel-connect').addEventListener('click', () => { clearConnection(); $('#password').focus(); });

export async function openEditor(client) {
  store = client;
  publication = null;
  const loaded = await client.load();
  groups = loaded.groups; deleted = []; uploads = new Map(); selected = groups[0]?.path || '';
  let restored = false;
  try {
    const draft = await readDraft();
    if (draft?.version === 1 && Array.isArray(draft.groups) && Array.isArray(draft.deleted) && Array.isArray(draft.uploads)
      && (draft.groups.some(group => group.dirty) || draft.deleted.length)) {
      groups = draft.groups; deleted = draft.deleted; uploads = new Map(draft.uploads);
      selected = groups.some(group => group.path === draft.selected) ? draft.selected : groups[0]?.path || ''; restored = true;
    }
  } catch { memoryOnly = true; }
  $('#login-screen').hidden = true; $('#editor').hidden = false; render();
  notice(restored ? 'Seu rascunho anterior foi recuperado. Revise as alterações antes de publicar.' : '');
  resetIdle(); clearTimeout(absoluteTimer); absoluteTimer = setTimeout(() => lock('Entre novamente para continuar.'), 2 * 60 * 60 * 1000);
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#login-submit'); button.disabled = true; $('#reconnect').disabled = true; button.textContent = 'Entrando…'; $('#login-message').textContent = '';
  let client;
  try {
    if (!crypto.subtle) throw new Error('Abra o painel pelo endereço HTTPS do seu site.');
    const username = $('#username').value.trim();
    const password = $('#password').value;
    if (!await verifyLogin(username, password)) throw new Error('Usuário ou senha incorretos.');
    if (!vault || event.submitter?.id === 'reconnect') { showConnection(password); return; }
    const token = await unlockVault(vault, username, password); $('#password').value = '';
    client = new GitHubStore(token); await client.authenticate(); await openEditor(client);
  } catch (error) { client?.close(); store = null; $('#login-message').textContent = error.message; }
  finally { $('#password').value = ''; button.disabled = false; $('#reconnect').disabled = false; button.textContent = 'Entrar'; }
});
$('#connect-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#connect-submit'); const cancel = $('#cancel-connect');
  button.disabled = true; cancel.disabled = true; button.textContent = 'Conectando…'; $('#connect-message').textContent = '';
  clearTimeout(connectionTimer);
  let client;
  try {
    if (!connectionPassword) throw new Error('Entre novamente para conectar a publicação.');
    const token = $('#github-key').value.trim(); $('#github-key').value = '';
    if (token.length < 20 || /\s/.test(token)) throw new Error('Cole a chave de publicação gerada no GitHub.');
    client = new GitHubStore(token); await client.authenticate();
    const next = await createVault(ADMIN_USERNAME, connectionPassword, token);
    let persisted = true;
    try { localStorage.setItem(ACCESS_KEY, JSON.stringify(next)); }
    catch { persisted = false; }
    vault = next; $('#reconnect').hidden = false; clearConnection();
    await openEditor(client);
    if (!persisted) notice('Publicação conectada só nesta aba. O navegador bloqueou o armazenamento; mantenha a aba aberta até publicar.', true);
  } catch (error) {
    client?.close(); store = null;
    (connectionPassword ? $('#connect-message') : $('#login-message')).textContent = error.message;
  } finally {
    $('#github-key').value = ''; button.disabled = false; cancel.disabled = false; button.textContent = 'Conectar e abrir painel';
    if (connectionPassword) connectionTimeout();
  }
});
try {
  const saved = localStorage.getItem(ACCESS_KEY);
  if (saved) { const candidate = validateVault(JSON.parse(saved)); if (candidate.username === ADMIN_USERNAME) vault = candidate; }
} catch { /* The owner can connect directly on this page. */ }
$('#reconnect').hidden = !vault;

$('#reload-groups').addEventListener('click', async () => {
  if (publishing || processing || !store) return;
  if (dirtyCount() && !await confirmAction('Recarregar os grupos?', 'As alterações deste rascunho serão descartadas. O conteúdo publicado será carregado novamente.', 'Recarregar')) return;
  const button = $('#reload-groups'); button.disabled = true;
  try { const loaded = await store.load(); groups = loaded.groups; deleted = []; uploads.clear(); selected = groups[0]?.path || ''; await clearDraft(); render(); notice('Grupos atualizados.'); }
  catch (error) { notice(error.message, true); }
  finally { button.disabled = false; }
});
function setEditorBusy(value) {
  for (const element of document.querySelectorAll('#editor input, #editor select, #editor textarea, #editor button')) element.disabled = value;
  for (const element of document.querySelectorAll('.photo-card')) element.draggable = !value;
}
async function watchPublication(expected, generation) {
  const deadline = Date.now() + 120000;
  for (let attempt = 0; attempt < 30 && Date.now() < deadline && generation === publishGeneration; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    if (generation !== publishGeneration) return;
    try {
      const live = await checkLivePublication(expected, { basePath });
      if (generation !== publishGeneration) return;
      if (live) {
        publication = { phase: 'success', sha: expected.sha, message: 'Concluído. As fotos e os grupos foram conferidos no site.' };
        updateStatus(); notice('Publicação concluída. Clique em Ver publicação para conferir as fotos.'); return;
      }
    } catch { /* A temporary site error must not be reported as a successful publication. */ }
    if (attempt % 3 !== 0 || Date.now() >= deadline) continue;
    try {
      const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/runs?head_sha=${encodeURIComponent(expected.sha)}&per_page=5`, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (generation !== publishGeneration) return;
      if (!response.ok) continue;
      const data = await response.json(); const run = data.workflow_runs?.find(item => item.name === 'Publicar no GitHub Pages');
      if (generation !== publishGeneration) return;
      if (run?.status === 'completed' && run.conclusion !== 'success') {
        publication = { phase: 'error', sha: expected.sha, message: 'Fotos salvas no GitHub, mas a publicação falhou. Confira a execução no GitHub.' };
        updateStatus(); notice(publication.message, true); return;
      }
    } catch { /* Keep checking the public site even when Actions cannot be queried. */ }
  }
  if (generation === publishGeneration) {
    publication = { phase: 'pending', sha: expected.sha, message: 'Fotos salvas no GitHub. A confirmação demorou mais que o esperado; confira Ver site ou a publicação no GitHub.' };
    updateStatus(); notice(publication.message, true);
  }
}
$('#publish').addEventListener('click', async () => {
  if (!store || publishing || processing || !dirtyCount()) return;
  publishing = true; setEditorBusy(true); updateStatus('Enviando os grupos e as fotos…'); notice('');
  const generation = ++publishGeneration;
  publication = null;
  const client = store;
  try {
    const result = await client.publish(groups, deleted, uploads, (done, total) => updateStatus(`Enviando arquivo ${done} de ${total}…`));
    const expected = { ...result, deleted: deleted.map(group => group.path) };
    for (const group of groups) {
      if (result.files?.[group.path]) group.sha = result.files[group.path];
      group.dirty = false;
    }
    deleted = []; uploads.clear(); clearTimeout(draftTimer); await saveSequence.catch(() => {});
    try { await clearDraft(); } catch { memoryOnly = true; }
    publication = { phase: 'waiting', sha: result.sha, message: 'Fotos enviadas. Aguardando o site receber a nova versão…' };
    notice('Fotos e grupos enviados. O GitHub está atualizando o site.');
    watchPublication(expected, generation);
  } catch (error) { notice(error.message, true); await persistDraft(); }
  finally { publishing = false; setEditorBusy(false); render(); resetIdle(); }
});
window.addEventListener('beforeunload', event => {
  if (store && (dirtyCount() || processing || publishing)) { event.preventDefault(); event.returnValue = ''; }
});

