const state = { site: null, allProjects: [], featuredPhotos: [], featuredIndex: 0 };
const $ = (selector) => document.querySelector(selector);
const pagesBasePath = window.location.hostname === 'febuen0.github.io' ? '/fephotoportifolio' : '';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[character]));

function assetUrl(value = '') {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
  return value.startsWith('/') ? `${pagesBasePath}${value}` : value;
}

function renderBackgrounds(backgrounds) {
  const container = $('.background-stack');
  container.innerHTML = Object.entries(backgrounds).map(([name, url]) =>
    `<div class="background-layer${name === 'hero' ? ' is-active' : ''}" data-background-layer="${escapeHtml(name)}" style="background-image:url('${escapeHtml(assetUrl(url))}')"></div>`
  ).join('');
}

function renderAbout(paragraphs) {
  $('#about-text').innerHTML = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

function renderWork(steps) {
  $('#work-steps').innerHTML = steps.map((step) => `
    <li class="work-step reveal">
      <div><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.text)}</p></div>
    </li>`).join('');
}

function emailLink(email) {
  const [user, domain] = email.split('@');
  return `<a class="contact-link email-link" data-user="${escapeHtml(user)}" data-domain="${escapeHtml(domain)}" href="#contato"><span>E-mail</span><small>carregar endereço ↗</small></a>`;
}

function renderContacts(contacts) {
  $('#contact-links').innerHTML = [
    emailLink(contacts.email),
    `<a class="contact-link" href="${escapeHtml(contacts.whatsapp)}" target="_blank" rel="noopener noreferrer"><span>WhatsApp</span><small>abrir conversa ↗</small></a>`,
    `<a class="contact-link" href="${escapeHtml(contacts.instagramUrl)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(contacts.instagram)}</span><small>ver perfil ↗</small></a>`
  ].join('');
  $('.email-link').addEventListener('click', (event) => {
    event.preventDefault();
    const link = event.currentTarget;
    const email = `${link.dataset.user}@${link.dataset.domain}`;
    link.href = `mailto:${email}`;
    link.querySelector('small').textContent = email;
    window.location.href = link.href;
  }, { once: true });
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function featuredPhotos(projects) {
  return shuffle(projects.flatMap((project) => project.media?.mode === 'images'
    ? (project.media.images || []).filter((photo) => photo.image).map((photo) => ({ ...photo, project }))
    : []
  )).slice(0, 5);
}

function renderFeaturedProject() {
  const stage = $('#project-stage');
  const counter = $('#featured-counter');
  const previous = $('#previous-project');
  const next = $('#next-project');
  const photo = state.featuredPhotos[state.featuredIndex];

  previous.disabled = state.featuredIndex === 0;
  next.disabled = state.featuredIndex === state.featuredPhotos.length;
  if (!photo) {
    stage.innerHTML = `<article class="featured-project-cta">
      <p class="project-meta">Seleção completa</p>
      <h3>Ver todos os projetos</h3>
      <p>Ensaios, vídeos e motions organizados por tema.</p>
      <a class="projects-page-link" href="trabalhos/">Abrir todos os projetos <span aria-hidden="true">↗</span></a>
    </article>`;
    counter.textContent = 'Seleção completa';
    next.setAttribute('aria-label', 'Fim da seleção');
    return;
  }

  stage.innerHTML = `<article class="featured-project-card">
    <figure class="featured-project-media"><img src="${escapeHtml(assetUrl(photo.image))}" alt="${escapeHtml(photo.alt || `Foto de ${photo.project.title}`)}" decoding="async" /></figure>
    <div class="featured-project-copy">
      <h3>${escapeHtml(photo.project.title)}</h3>
    </div>
  </article>`;
  counter.textContent = `${String(state.featuredIndex + 1).padStart(2, '0')} / ${String(state.featuredPhotos.length).padStart(2, '0')}`;
  next.setAttribute('aria-label', state.featuredIndex === state.featuredPhotos.length - 1 ? 'Ver todos os projetos' : 'Próxima foto');
  stage.querySelector('img').addEventListener('error', () => {
    state.featuredPhotos.splice(state.featuredIndex, 1);
    state.featuredIndex = Math.min(state.featuredIndex, state.featuredPhotos.length);
    renderFeaturedProject();
  }, { once: true });
}

function observeSections() {
  const backgrounds = document.querySelectorAll('[data-background-layer]');
  const sections = document.querySelectorAll('[data-background]');
  const setActiveBackground = (key) => {
    backgrounds.forEach((layer) => layer.classList.toggle('is-active', layer.dataset.backgroundLayer === key));
    document.documentElement.classList.toggle('is-hero-active', key === 'hero');
    document.documentElement.classList.toggle('is-projects-active', key === 'projects');
  };
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActiveBackground(visible.target.dataset.background);
  }, { threshold: [0.3, 0.55, 0.75] });
  sections.forEach((section) => sectionObserver.observe(section));

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let scheduled = false;
    const updateBackgroundMovement = () => {
      scheduled = false;
      sections.forEach((section) => {
        const layer = document.querySelector(`[data-background-layer="${section.dataset.background}"]`);
        if (!layer) return;
        const rect = section.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (window.innerHeight / 2 - (rect.top + rect.height / 2)) / (window.innerHeight / 2)));
        layer.style.setProperty('--parallax-offset', `${Math.round(progress * 34)}px`);
      });
      const viewportCenter = window.innerHeight / 2;
      const centeredSection = Array.from(sections).find((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= viewportCenter && rect.bottom > viewportCenter;
      });
      if (centeredSection) setActiveBackground(centeredSection.dataset.background);
    };
    const requestBackgroundUpdate = () => {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(updateBackgroundMovement);
      }
    };
    window.addEventListener('scroll', requestBackgroundUpdate, { passive: true });
    window.addEventListener('resize', requestBackgroundUpdate);
    requestBackgroundUpdate();
  }

  const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
}

function bindFeaturedNavigation() {
  $('#previous-project').addEventListener('click', () => {
    state.featuredIndex = Math.max(0, state.featuredIndex - 1);
    renderFeaturedProject();
  });
  $('#next-project').addEventListener('click', () => {
    state.featuredIndex = Math.min(state.featuredPhotos.length, state.featuredIndex + 1);
    renderFeaturedProject();
  });
}

function bindMobileMenu() {
  const toggle = $('.menu-toggle');
  const menu = $('#site-menu');
  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  };
  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Abrir menu' : 'Fechar menu');
    menu.classList.toggle('is-open', !isOpen);
    document.body.classList.toggle('menu-open', !isOpen);
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
}

async function initialise() {
  try {
    const [siteResponse, projectsResponse] = await Promise.all([fetch('data/site.json'), fetch('data/projects.json')]);
    if (!siteResponse.ok || !projectsResponse.ok) throw new Error('Não foi possível carregar os dados.');
    state.site = await siteResponse.json();
    state.allProjects = await projectsResponse.json();
    state.featuredPhotos = featuredPhotos(state.allProjects);
    document.title = state.site.seo?.title || document.title;
    $('#hero-subtitle').innerHTML = escapeHtml(state.site.intro || '').replace(/, /g, ',<br>');
    document.querySelector('meta[name="description"]').content = state.site.seo?.description || '';
    renderBackgrounds(state.site.backgrounds);
    renderAbout(state.site.about);
    renderWork(state.site.workSteps);
    renderContacts(state.site.contacts);
    renderFeaturedProject();
    bindFeaturedNavigation();
    bindMobileMenu();
    observeSections();
  } catch (error) {
    $('#project-stage').innerHTML = '<p class="loading">Erro ao carregar os projetos. Tente atualizar a página.</p>';
    console.error(error);
  }
}

$('#year').textContent = new Date().getFullYear();
initialise();
