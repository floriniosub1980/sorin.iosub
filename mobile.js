/* Mobile navigation: close after selecting a section, on Escape, or after resize. */
(() => {
  // Keep Instagram accessible in the footer of every page, including artwork pages.
  const footer = document.querySelector('.site-footer');
  if (footer && !footer.querySelector('.footer-instagram')) {
    const link = document.createElement('a');
    link.className = 'footer-instagram';
    link.href = 'https://www.instagram.com/iosubgsorin/';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Instagram — @iosubgsorin');
    link.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.7" cy="6.4" r="1" fill="currentColor" stroke="none"></circle></svg>';
    const backToTop = footer.querySelector('a[href="#content"]');
    if (backToTop) footer.insertBefore(link, backToTop);
    else footer.append(link);
  }

  const menu = document.querySelector('.mobile-menu');
  if (!menu) return;
  menu.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', () => menu.removeAttribute('open'));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
  document.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', event => {
    if (event.matches) menu.open = false;
  });
})();
