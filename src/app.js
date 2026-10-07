const state = { site: null, allProjects: [], filteredProjects: [], current: 0 };
const $ = (selector) => document.querySelector(selector);

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[character]));

function renderBackgrounds(backgrounds) {
  const container = $('.background-stack');
  container.innerHTML = Object.entries(backgrounds).map(([name, url]) =>
    `<div class="background-layer${name === 'hero' ? ' is-active' : ''}" data-background-layer="${escapeHtml(name)}" style="background-image:url('${escapeHtml(url)}')"></div>`
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

function thumbnailFor(project) {
  if (project.media?.mode === 'video' && project.media?.poster) return project.media.poster;
  if (project.media?.images?.[0]?.image) return project.media.images[0].image;
  if (project.media?.youtubeId) return `https://i.ytimg.com/vi/${project.media.youtubeId}/hqdefault.jpg`;
  return '';
}

function projectMedia(project) {
  const cover = thumbnailFor(project);
  const alt = project.media?.images?.[0]?.alt || `Capa do projeto ${project.title}`;
  if (project.media?.mode === 'youtube' && project.media.youtubeId) {
    return `<div class="project-media">
      <span class="media-label">Vídeo</span>
      <img src="${escapeHtml(cover)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />
      <button class="play-button" type="button" data-youtube="${escapeHtml(project.media.youtubeId)}" aria-label="Carregar vídeo de ${escapeHtml(project.title)}">Assistir</button>
    </div>`;
  }
  if (project.media?.mode === 'video' && project.media.video) {
    return `<div class="project-media">
      <span class="media-label">Motion</span>
      <video controls playsinline preload="metadata" poster="${escapeHtml(project.media.poster || cover)}" aria-label="Vídeo: ${escapeHtml(project.title)}">
        <source src="${escapeHtml(project.media.video)}" type="video/mp4" />
        Seu navegador não suporta vídeo HTML5.
      </video>
    </div>`;
  }
  const images = project.media?.images || [];
  if (images.length > 1) {
    return `<div class="project-media project-gallery" data-gallery>
      <span class="media-label">Foto <b data-gallery-counter>01/${String(images.length).padStart(2, '0')}</b></span>
      <img src="${escapeHtml(images[0].image)}" alt="${escapeHtml(images[0].alt || alt)}" loading="lazy" decoding="async" data-gallery-image />
      <div class="gallery-controls" aria-label="Navegar pelas fotos do projeto">
        <button type="button" data-gallery-previous aria-label="Foto anterior">←</button>
        <button type="button" data-gallery-next aria-label="Próxima foto">→</button>
      </div>
    </div>`;
  }
  return `<div class="project-media">
    <span class="media-label">Fotos</span>
    <img src="${escapeHtml(cover)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />
  </div>`;
}

function renderProject() {
  const project = state.filteredProjects[state.current];
  const stage = $('#project-stage');
  if (!project) {
    stage.innerHTML = '<p class="loading">Nenhum projeto neste filtro.</p>';
    $('#project-thumbnails').innerHTML = '';
    return;
  }
  stage.innerHTML = `<article class="project-card">
      ${projectMedia(project)}
      <div class="project-copy">
        <div>
          <p class="project-meta">${escapeHtml(project.type)} · ${project.isExample ? 'EXEMPLO' : 'PORTFÓLIO'}</p>
          <h3>${escapeHtml(project.title)}</h3>
          <p><strong>Desafio:</strong> ${escapeHtml(project.description.challenge)}</p>
          <p><strong>O que fiz:</strong> ${escapeHtml(project.description.role)}</p>
          <p><strong>Resultado:</strong> ${escapeHtml(project.description.result)}</p>
        </div>
        ${project.isExample ? '<span class="example-tag">Conteúdo de exemplo — trocar</span>' : ''}
      </div>
    </article>`;
  const play = stage.querySelector('[data-youtube]');
  if (play) {
    play.addEventListener('click', () => {
      const id = play.dataset.youtube;
      const wrapper = play.closest('.project-media');
      wrapper.innerHTML = `<iframe title="Vídeo: ${escapeHtml(project.title)}" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    }, { once: true });
  }
  const gallery = stage.querySelector('[data-gallery]');
  if (gallery) {
    const images = project.media.images;
    let imageIndex = 0;
    const image = gallery.querySelector('[data-gallery-image]');
    const counter = gallery.querySelector('[data-gallery-counter]');
    const showImage = (nextIndex) => {
      imageIndex = (nextIndex + images.length) % images.length;
      image.style.opacity = '0';
      window.setTimeout(() => {
        image.src = images[imageIndex].image;
        image.alt = images[imageIndex].alt || `Foto ${imageIndex + 1} de ${project.title}`;
        counter.textContent = `${String(imageIndex + 1).padStart(2, '0')}/${String(images.length).padStart(2, '0')}`;
        image.style.opacity = '1';
      }, 120);
    };
    gallery.querySelector('[data-gallery-previous]').addEventListener('click', () => showImage(imageIndex - 1));
    gallery.querySelector('[data-gallery-next]').addEventListener('click', () => showImage(imageIndex + 1));
  }
  renderThumbnails();
}

function renderThumbnails() {
  $('#project-thumbnails').innerHTML = state.filteredProjects.map((project, index) => {
    const current = index === state.current;
    return `<button class="thumbnail" type="button" data-project-index="${index}" aria-label="Abrir ${escapeHtml(project.title)}" aria-current="${current}">
      <img src="${escapeHtml(thumbnailFor(project))}" alt="" loading="lazy" decoding="async" />
    </button>`;
  }).join('');
  document.querySelectorAll('[data-project-index]').forEach((button) => button.addEventListener('click', () => {
    state.current = Number(button.dataset.projectIndex);
    renderProject();
  }));
}

function applyFilter(filter) {
  state.filteredProjects = filter === 'all' ? [...state.allProjects] : state.allProjects.filter((project) => project.type === filter);
  state.current = 0;
  renderProject();
}

function observeSections() {
  const backgrounds = document.querySelectorAll('[data-background-layer]');
  const sections = document.querySelectorAll('[data-background]');
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const key = visible.target.dataset.background;
    backgrounds.forEach((layer) => layer.classList.toggle('is-active', layer.dataset.backgroundLayer === key));
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

async function initialise() {
  try {
    const [siteResponse, projectsResponse] = await Promise.all([fetch('data/site.json'), fetch('data/projects.json')]);
    if (!siteResponse.ok || !projectsResponse.ok) throw new Error('Não foi possível carregar os dados.');
    state.site = await siteResponse.json();
    state.allProjects = await projectsResponse.json();
    state.filteredProjects = [...state.allProjects];
    document.title = state.site.seo?.title || document.title;
    $('#hero-subtitle').innerHTML = escapeHtml(state.site.intro || '').replace(/, /g, ',<br>');
    document.querySelector('meta[name="description"]').content = state.site.seo?.description || '';
    renderBackgrounds(state.site.backgrounds);
    renderAbout(state.site.about);
    renderWork(state.site.workSteps);
    renderContacts(state.site.contacts);
    renderProject();
    observeSections();
  } catch (error) {
    $('#project-stage').innerHTML = '<p class="loading">Erro ao carregar os projetos. Tente atualizar a página.</p>';
    console.error(error);
  }
}

document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('is-selected', item === button));
  applyFilter(button.dataset.filter);
}));
$('#previous-project').addEventListener('click', () => {
  if (!state.filteredProjects.length) return;
  state.current = (state.current - 1 + state.filteredProjects.length) % state.filteredProjects.length;
  renderProject();
});
$('#next-project').addEventListener('click', () => {
  if (!state.filteredProjects.length) return;
  state.current = (state.current + 1) % state.filteredProjects.length;
  renderProject();
});
$('#year').textContent = new Date().getFullYear();
initialise();
