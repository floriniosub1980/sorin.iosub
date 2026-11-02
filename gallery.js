/* Sorin Iosub portfolio: read the public bilingual artwork catalogue from Cloudflare R2. */
(() => {
  'use strict';
  const grid = document.querySelector('[data-r2-artworks]');
  if (!grid) return;

  const lang = grid.getAttribute('data-r2-artworks') === 'ro' ? 'ro' : 'en';
  const catalogUrl = 'https://media.soriniosub.com/data/artworks.json';
  const labels = {
    en: { pending: 'Details to be confirmed', empty: 'No artworks are published yet.',
      unavailable: 'The gallery is temporarily unavailable.', retry: 'Try again',
      open: 'View full artwork image', categories: { paintings: 'Painting', frescoes: 'Fresco', graphics: 'Graphic art' } },
    ro: { pending: 'Detalii în curs de confirmare', empty: 'Nu sunt încă lucrări publicate.',
      unavailable: 'Galeria este temporar indisponibilă.', retry: 'Reîncearcă',
      open: 'Vezi imaginea completă', categories: { paintings: 'Pictură', frescoes: 'Frescă', graphics: 'Grafică' } }
  }[lang];

  const pick = (value) => typeof value === 'string' ? value :
    value && typeof value === 'object' ? (value[lang] || value.en || value.ro || '') : '';

  function mediaUrl(value) {
    if (typeof value !== 'string') return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'media.soriniosub.com' ? url.href : '';
    } catch {
      return '';
    }
  }

  function paragraph(text, className) {
    const node = document.createElement('p');
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function showNotice(message, canRetry) {
    grid.replaceChildren();
    grid.append(paragraph(message, 'artwork-message'));
    if (canRetry) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'artwork-retry';
      retry.textContent = labels.retry;
      retry.addEventListener('click', load);
      grid.append(retry);
    }
    grid.setAttribute('aria-busy', 'false');
  }

  function render(items) {
    grid.replaceChildren();
    let count = 0;

    for (const work of items) {
      if (!work || work.published === false) continue;
      const image = mediaUrl(work.images && work.images.thumbnail);
      const full = mediaUrl(work.images && work.images.full) || image;
      if (!image || !full) continue;

      const card = document.createElement('article');
      card.className = 'art-card artwork-from-r2';

      const link = document.createElement('a');
      link.className = 'art-frame real-artwork';
      link.href = full;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', labels.open + ': ' + (pick(work.title) || work.id || ''));

      const photo = document.createElement('img');
      photo.src = image;
      photo.alt = pick(work.alt) || pick(work.title) || '';
      photo.loading = count < 3 ? 'eager' : 'lazy';
      photo.decoding = 'async';
      link.append(photo);
      card.append(link);

      const info = document.createElement('div');
      info.className = 'art-info';
      const body = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = pick(work.title) || work.id || (lang === 'ro' ? 'Fără titlu' : 'Untitled');
      body.append(title);

      const details = [
        labels.categories[work.category] || '',
        Number.isInteger(work.year) ? String(work.year) : '',
        pick(work.technique),
        work.dimensionsCm && Number.isFinite(work.dimensionsCm.width) && Number.isFinite(work.dimensionsCm.height)
          ? work.dimensionsCm.width + ' × ' + work.dimensionsCm.height + ' cm' : ''
      ].filter(Boolean);

      body.append(paragraph(details.length ? details.join(' · ') : labels.pending, 'artwork-meta'));

      const description = pick(work.description);
      if (description) body.append(paragraph(description, 'artwork-description'));
      info.append(body);
      card.append(info);
      grid.append(card);
      count++;
    }
    if (!count) showNotice(labels.empty, false);
    else grid.setAttribute('aria-busy', 'false');
  }

  async function load() {
    grid.setAttribute('aria-busy', 'true');
    grid.replaceChildren(paragraph(lang === 'ro' ? 'Se încarcă lucrările…' : 'Loading artworks…', 'artwork-message'));
    try {
      const response = await fetch(catalogUrl, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const catalogue = await response.json();
      if (!catalogue || catalogue.schemaVersion !== 1 || !Array.isArray(catalogue.artworks)) {
        throw new Error('Unexpected catalogue structure');
      }
      render(catalogue.artworks);
    } catch (error) {
      console.warn('Cloudflare R2 artwork catalogue could not be loaded:', error);
      showNotice(labels.unavailable, true);
    }
  }

  load();
})();
