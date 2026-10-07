const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
const pagesBasePath = window.location.hostname === 'febuen0.github.io' ? '/fephotoportifolio' : '';

function assetUrl(value = '') {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
  return value.startsWith('/') ? `${pagesBasePath}${value}` : value;
}

function motionMedia(project) {
  const poster = assetUrl(project.media.poster || '');
  return `<div class="motion-media" data-motion-player>
    <span class="media-label">Motion</span>
    <video data-motion-video muted playsinline preload="metadata" poster="${escapeHtml(poster)}" aria-label="Vídeo: ${escapeHtml(project.title)}">
      <source src="${escapeHtml(assetUrl(project.media.video))}" type="video/mp4" />
      Seu navegador não suporta vídeo HTML5.
    </video>
    <button class="motion-restart" type="button" data-motion-restart hidden aria-label="Recomeçar ${escapeHtml(project.title)}">↻ <span>Recomeçar</span></button>
  </div>`;
}

function imageMedia(project) {
  const images = (project.media?.images || []).filter((item) => item.image);
  return `<div class="project-media-grid">
    ${images.map((item) => `<figure class="project-photo"><img src="${escapeHtml(assetUrl(item.image))}" alt="${escapeHtml(item.alt || `Foto de ${project.title}`)}" loading="lazy" decoding="async" /></figure>`).join('')}
  </div>`;
}

function projectMarkup(project) {
  const isMotion = project.type === 'Motion' && project.media?.mode === 'video' && project.media.video;
  const media = isMotion ? motionMedia(project) : imageMedia(project);
  return `<article class="work-project${isMotion ? ' work-project-motion' : ''}">
    ${isMotion ? '' : `<header class="work-project-header"><h2>${escapeHtml(project.title)}</h2></header>`}
    ${media}
  </article>`;
}

function startMotion(player) {
  const video = player.querySelector('[data-motion-video]');
  const restart = player.querySelector('[data-motion-restart]');
  let completedLoops = 0;
  restart.hidden = true;
  video.pause();
  video.currentTime = 0;
  video.onended = () => {
    completedLoops += 1;
    if (completedLoops < 3) {
      video.currentTime = 0;
      video.play().catch(() => { restart.hidden = false; });
      return;
    }
    restart.hidden = false;
  };
  video.play().catch(() => { restart.hidden = false; });
}

function setupMotionPlayers(root = document) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    observer.unobserve(entry.target);
    if (!reducedMotion) startMotion(entry.target);
  }), { threshold: .6 });

  root.querySelectorAll('[data-motion-player]').forEach((player) => {
    const restart = player.querySelector('[data-motion-restart]');
    restart.addEventListener('click', () => startMotion(player));
    if (reducedMotion) restart.hidden = false;
    observer.observe(player);
  });
}

function renderGroups(projects) {
  const validProjects = projects.filter((project) => (project.media?.mode === 'video' && project.media.video)
    || (project.media?.images || []).some((item) => item.image));
  const groups = validProjects.reduce((map, project) => {
    const type = project.type || 'Outros';
    if (!map.has(type)) map.set(type, []);
    map.get(type).push(project);
    return map;
  }, new Map());
  const order = ['Ensaio pessoal', 'Ensaio para marcas', 'Vídeo', 'Motion'];
  const sortedGroups = [...groups.entries()].sort(([first], [second]) => {
    const firstPosition = order.indexOf(first);
    const secondPosition = order.indexOf(second);
    return (firstPosition === -1 ? order.length : firstPosition) - (secondPosition === -1 ? order.length : secondPosition);
  });
  $('#works-groups').innerHTML = sortedGroups.map(([type, entries]) => `<section class="work-topic" aria-label="${escapeHtml(type)}">
    ${type === 'Motion' ? '<div class="motion-topic-heading"><h2>Motion</h2></div>' : ''}
    <div class="work-topic-projects">${entries.map(projectMarkup).join('')}</div>
  </section>`).join('');
  $('#works-groups').querySelectorAll('img').forEach((image) => image.addEventListener('error', () => {
    const photo = image.closest('.project-photo');
    if (!photo) return;
    const grid = photo.parentElement;
    photo.remove();
    if (!grid.querySelector('img')) grid.closest('.work-project')?.remove();
  }, { once: true }));
  setupMotionPlayers($('#works-groups'));
}

async function initialise() {
  const response = await fetch('../data/projects.json');
  if (!response.ok) throw new Error('Não foi possível carregar os trabalhos.');
  const projects = await response.json();
  renderGroups(projects.sort((first, second) => (first.order || 0) - (second.order || 0)));
}

initialise().catch(() => { $('#works-groups').innerHTML = '<p class="loading">Não foi possível carregar os trabalhos.</p>'; });
