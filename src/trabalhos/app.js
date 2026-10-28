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
    <span class="media-label">${escapeHtml(project.type || 'Vídeo')}</span>
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
  const isVideo = project.media?.mode === 'video' && project.media.video;
  const media = isVideo ? motionMedia(project) : imageMedia(project);
  return `<article class="work-project${isVideo ? ' work-project-motion' : ''}">
    ${isVideo ? '' : `<header class="work-project-header"><h2>${escapeHtml(project.title)}</h2></header>`}
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
  const players = [...root.querySelectorAll('[data-motion-player]')];
  if (!players.length) return () => {};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    observer.unobserve(entry.target);
    if (!reducedMotion) startMotion(entry.target);
  }), { threshold: .6 });

  players.forEach((player) => {
    const restart = player.querySelector('[data-motion-restart]');
    restart.addEventListener('click', () => startMotion(player));
    if (reducedMotion) restart.hidden = false;
    observer.observe(player);
  });
  return () => {
    observer.disconnect();
    players.forEach((player) => {
      const video = player.querySelector('[data-motion-video]');
      video.onended = null;
      video.pause();
    });
  };
}

function renderGroups(projects) {
  const validProjects = projects.filter((project) => (project.media?.mode === 'video' && project.media.video)
    || (project.media?.images || []).some((item) => item.image));
  const groups = validProjects.filter((project) => project.type !== 'Motion')
    .map((project) => ({ title: project.title || project.type || 'Projeto', entries: [project] }));
  const motion = validProjects.filter((project) => project.type === 'Motion');
  if (motion.length) groups.push({ title: 'Motion', entries: motion, isMotion: true });
  const tabs = $('#works-tabs');
  const panel = $('#works-groups');
  panel.setAttribute('aria-busy', 'false');
  if (!groups.length) {
    panel.innerHTML = '<p class="loading">Em breve, novos trabalhos por aqui.</p>';
    return;
  }
  const buttons = groups.map((group, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `work-tab-${index}`;
    button.className = 'works-tab';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'works-groups');
    button.setAttribute('aria-selected', 'false');
    button.tabIndex = -1;
    button.textContent = group.title;
    return button;
  });
  tabs.replaceChildren(...buttons);
  tabs.hidden = false;
  let selected = -1;
  let stopMotion = () => {};
  function selectGroup(index, focus = false) {
    const scrollBack = selected !== -1 && panel.getBoundingClientRect().top < tabs.getBoundingClientRect().bottom;
    if (focus) buttons[index].focus({ preventScroll: true });
    if (selected === index) return;
    stopMotion();
    selected = index;
    buttons.forEach((button, position) => {
      button.setAttribute('aria-selected', String(position === index));
      button.tabIndex = position === index ? 0 : -1;
    });
    const group = groups[index];
    panel.removeAttribute('aria-label');
    panel.setAttribute('aria-labelledby', buttons[index].id);
    panel.innerHTML = `<div class="work-topic-projects${group.isMotion ? ' work-topic-projects--motion' : ''}">${group.entries.map(projectMarkup).join('')}</div>`;
    panel.querySelectorAll('img').forEach((image) => image.addEventListener('error', () => {
      const photo = image.closest('.project-photo');
      if (!photo) return;
      const grid = photo.parentElement;
      photo.remove();
      if (!grid.querySelector('img')) grid.closest('.work-project')?.remove();
    }, { once: true }));
    stopMotion = setupMotionPlayers(panel);
    if (scrollBack) panel.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => selectGroup(index));
    button.addEventListener('keydown', (event) => {
      const next = event.key === 'ArrowRight' ? (index + 1) % groups.length
        : event.key === 'ArrowLeft' ? (index - 1 + groups.length) % groups.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? groups.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      selectGroup(next, true);
    });
  });
  function updateStickySpacing() {
    document.documentElement.style.setProperty('--works-header-height', `${$('.works-header').getBoundingClientRect().height}px`);
    document.documentElement.style.setProperty('--works-tabs-height', `${tabs.getBoundingClientRect().height}px`);
  }
  updateStickySpacing();
  const resizeObserver = new ResizeObserver(updateStickySpacing);
  resizeObserver.observe($('.works-header'));
  resizeObserver.observe(tabs);
  const defaultIndex = groups.findIndex((group) => group.title.trim().toLocaleLowerCase('pt-BR') === 'ensaio pessoal');
  selectGroup(defaultIndex === -1 ? 0 : defaultIndex);
}

async function initialise() {
  const response = await fetch(`../data/projects.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar os trabalhos.');
  const projects = await response.json();
  renderGroups(projects.sort((first, second) => (first.order || 0) - (second.order || 0)));
}

initialise().catch(() => {
  $('#works-groups').setAttribute('aria-busy', 'false');
  $('#works-groups').innerHTML = '<p class="loading">Não foi possível carregar os trabalhos.</p>';
});
