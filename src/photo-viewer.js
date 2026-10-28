(() => {
  const selector = '.project-photo img, .featured-project-media img';
  const viewer = document.createElement('dialog');
  viewer.className = 'photo-viewer';
  viewer.tabIndex = -1;
  viewer.setAttribute('aria-label', 'Foto ampliada. Clique para fechar ou pressione Escape.');
  const expanded = document.createElement('img');
  expanded.draggable = false;
  viewer.append(expanded);
  document.body.append(viewer);
  let origin;

  function prepare(root) {
    const images = [...root.querySelectorAll(selector)];
    if (root.matches?.(selector)) images.push(root);
    for (const image of images) {
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-haspopup', 'dialog');
      image.setAttribute('aria-label', `Ampliar foto${image.alt ? `: ${image.alt}` : ''}`);
    }
  }

  function open(image) {
    if (viewer.open) return;
    origin = image;
    expanded.src = image.currentSrc || image.src;
    expanded.alt = image.alt;
    document.documentElement.classList.add('photo-viewer-open');
    viewer.showModal();
    viewer.focus({ preventScroll: true });
  }

  document.addEventListener('click', event => {
    const image = event.target.closest(selector);
    if (image) open(image);
  });
  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || !event.target.matches(selector)) return;
    event.preventDefault();
    open(event.target);
  });
  viewer.addEventListener('click', () => viewer.close());
  viewer.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      viewer.close();
    }
  });
  viewer.addEventListener('close', () => {
    document.documentElement.classList.remove('photo-viewer-open');
    expanded.removeAttribute('src');
    if (origin?.isConnected) origin.focus({ preventScroll: true });
    origin = null;
  });

  prepare(document);
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) prepare(node);
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
