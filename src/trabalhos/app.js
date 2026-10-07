const state = { all: [], filtered: [], current: 0, type: 'all' };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));

const filters = ['Ensaio pessoal', 'Ensaio para marcas', 'Vídeo', 'Motion', 'all'];
const labelFor = (type) => type === 'all' ? 'Todos' : type;
const thumbnailFor = (project) => project.media?.mode === 'video' && project.media?.poster
  ? project.media.poster
  : project.media?.images?.[0]?.image || (project.media?.youtubeId ? `https://i.ytimg.com/vi/${project.media.youtubeId}/hqdefault.jpg` : '');

function preload(source) {
  if (!source) return;
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
}

function projectMedia(project) {
  const cover = thumbnailFor(project);
  const alt = project.media?.images?.[0]?.alt || `Capa do projeto ${project.title}`;
  if (project.media?.mode === 'youtube' && project.media.youtubeId) return `<div class="project-media"><span class="media-label">Vídeo</span><img src="${escapeHtml(cover)}" alt="${escapeHtml(alt)}" fetchpriority="high" decoding="async" /><button class="play-button" type="button" data-youtube="${escapeHtml(project.media.youtubeId)}">Assistir</button></div>`;
  if (project.media?.mode === 'video' && project.media.video) return `<div class="project-media"><span class="media-label">Motion</span><video controls playsinline preload="metadata" poster="${escapeHtml(project.media.poster || cover)}" aria-label="Vídeo: ${escapeHtml(project.title)}"><source src="${escapeHtml(project.media.video)}" type="video/mp4" /></video></div>`;
  const images = project.media?.images || [];
  if (images.length > 1) return `<div class="project-media project-gallery" data-gallery><span class="media-label">Foto <b data-gallery-counter>01/${String(images.length).padStart(2, '0')}</b></span><img class="gallery-image is-active" src="${escapeHtml(images[0].image)}" alt="${escapeHtml(images[0].alt || alt)}" fetchpriority="high" decoding="async" data-gallery-current /><img class="gallery-image" alt="" decoding="async" data-gallery-next-image /><div class="gallery-controls"><button type="button" data-gallery-previous aria-label="Foto anterior">←</button><button type="button" data-gallery-next aria-label="Próxima foto">→</button></div></div>`;
  return `<div class="project-media"><span class="media-label">Fotos</span><img src="${escapeHtml(cover)}" alt="${escapeHtml(alt)}" fetchpriority="high" decoding="async" /></div>`;
}

function renderProject() {
  const project = state.filtered[state.current];
  const stage = $('#works-stage');
  if (!project) { stage.innerHTML = '<p class="loading">Nenhum trabalho neste filtro.</p>'; $('#project-thumbnails').innerHTML = ''; return; }
  stage.innerHTML = `<article class="project-card"><div>${projectMedia(project)}</div><div class="project-copy"><div><p class="project-meta">${escapeHtml(project.type)}</p><h2>${escapeHtml(project.title)}</h2><p><strong>Desafio:</strong> ${escapeHtml(project.description.challenge)}</p><p><strong>O que fiz:</strong> ${escapeHtml(project.description.role)}</p><p><strong>Resultado:</strong> ${escapeHtml(project.description.result)}</p></div></div></article>`;
  const gallery = stage.querySelector('[data-gallery]');
  if (gallery) setupGallery(gallery, project);
  const play = stage.querySelector('[data-youtube]');
  if (play) play.addEventListener('click', () => { const wrapper = play.closest('.project-media'); wrapper.innerHTML = `<iframe title="Vídeo: ${escapeHtml(project.title)}" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(play.dataset.youtube)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; }, { once: true });
  renderThumbnails();
  preload(thumbnailFor(state.filtered[(state.current + 1) % state.filtered.length]));
}

function setupGallery(gallery, project) {
  const images = project.media.images;
  let index = 0;
  let busy = false;
  const current = gallery.querySelector('[data-gallery-current]');
  const next = gallery.querySelector('[data-gallery-next-image]');
  const counter = gallery.querySelector('[data-gallery-counter]');
  const warmNeighbours = () => { preload(images[(index + 1) % images.length].image); preload(images[(index - 1 + images.length) % images.length].image); };
  const show = (target) => {
    if (busy) return;
    const nextIndex = (target + images.length) % images.length;
    if (nextIndex === index) return;
    busy = true;
    const item = images[nextIndex];
    next.onload = () => {
      current.classList.remove('is-active');
      next.classList.add('is-active');
      window.setTimeout(() => {
        current.src = item.image;
        current.alt = item.alt || `Foto ${nextIndex + 1} de ${project.title}`;
        current.classList.add('is-active');
        next.classList.remove('is-active');
        next.removeAttribute('src');
        index = nextIndex;
        counter.textContent = `${String(index + 1).padStart(2, '0')}/${String(images.length).padStart(2, '0')}`;
        warmNeighbours();
        busy = false;
      }, 190);
    };
    next.src = item.image;
  };
  warmNeighbours();
  gallery.querySelector('[data-gallery-previous]').addEventListener('click', () => show(index - 1));
  gallery.querySelector('[data-gallery-next]').addEventListener('click', () => show(index + 1));
}

function renderThumbnails() {
  $('#project-thumbnails').innerHTML = state.filtered.map((project, index) => `<button class="thumbnail" type="button" data-project-index="${index}" aria-label="Abrir ${escapeHtml(project.title)}" aria-current="${index === state.current}"><img src="${escapeHtml(thumbnailFor(project))}" alt="" loading="lazy" decoding="async" /></button>`).join('');
  document.querySelectorAll('[data-project-index]').forEach((button) => button.addEventListener('click', () => { state.current = Number(button.dataset.projectIndex); renderProject(); }));
}

function renderFilters() {
  $('#work-filters').innerHTML = filters.map((type) => `<button class="filter${type === state.type ? ' is-selected' : ''}" type="button" data-filter="${escapeHtml(type)}">${escapeHtml(labelFor(type))}</button>`).join('');
  document.querySelectorAll('#work-filters [data-filter]').forEach((button) => button.addEventListener('click', () => { state.type = button.dataset.filter; state.filtered = state.type === 'all' ? [...state.all] : state.all.filter((project) => project.type === state.type); state.current = 0; history.replaceState(null, '', `?tipo=${encodeURIComponent(state.type)}`); renderFilters(); renderProject(); }));
}

function stepProject(direction) { state.current = (state.current + direction + state.filtered.length) % state.filtered.length; renderProject(); }

async function initialise() {
  const response = await fetch('../data/projects.json');
  if (!response.ok) throw new Error('Não foi possível carregar os trabalhos.');
  state.all = await response.json();
  const requested = new URLSearchParams(location.search).get('tipo');
  state.type = filters.includes(requested) ? requested : 'all';
  state.filtered = state.type === 'all' ? [...state.all] : state.all.filter((project) => project.type === state.type);
  renderFilters(); renderProject();
  $('#previous-project').addEventListener('click', () => stepProject(-1));
  $('#next-project').addEventListener('click', () => stepProject(1));
}

initialise().catch(() => { $('#works-stage').innerHTML = '<p class="loading">Não foi possível carregar os trabalhos.</p>'; });
