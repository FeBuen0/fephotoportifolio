(() => {
  const button = document.querySelector('.back-to-top');
  if (!button) return;
  const update = () => { button.hidden = window.scrollY < 300; };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('pageshow', update);
  button.addEventListener('click', () => {
    const target = document.querySelector('.works-tabs') || document.querySelector('h1');
    target?.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  });
  update();
})();
