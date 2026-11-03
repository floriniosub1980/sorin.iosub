/* Bilingual R2 catalogue, category filters and accessible artwork lightbox. */
(() => {
  'use strict';

  // Keep the original illustration as a fallback until the R2 hero image is available.
  const portrait = document.querySelector('.hero-portrait');
  if (portrait) {
    const reveal = () => {
      if (portrait.naturalWidth > 0) portrait.closest('.hero-art')?.classList.add('hero-art--loaded');
    };
    portrait.addEventListener('load', reveal);
    if (portrait.complete) reveal();
  }
  const grid = document.querySelector('[data-r2-artworks]');
  if (!grid) return;

  const lang = grid.dataset.r2Artworks === 'ro' ? 'ro' : 'en';
  const catalogueUrl = 'https://media.soriniosub.com/data/artworks.json';
  const l = {
    en: {
      loading: 'Loading artworks…', unavailable: 'The gallery is temporarily unavailable.',
      retry: 'Try again', empty: 'No artworks are published yet.',
      noResults: 'No artworks in this category yet.', pending: 'Details to be confirmed',
      filters: 'Filter artworks by category', all: 'All works', paintings: 'Painting',
      frescoes: 'Fresco', graphics: 'Graphic art', viewer: 'Artwork viewer',
      close: 'Close', previous: 'Previous artwork', next: 'Next artwork',
      zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset zoom',
      enlarge: 'View artwork in the gallery', of: 'of'
    },
    ro: {
      loading: 'Se încarcă lucrările…', unavailable: 'Galeria este temporar indisponibilă.',
      retry: 'Reîncearcă', empty: 'Nu sunt încă lucrări publicate.',
      noResults: 'Nu există încă lucrări în această categorie.',
      pending: 'Detalii în curs de confirmare',
      filters: 'Filtrează lucrările după categorie', all: 'Toate lucrările',
      paintings: 'Pictură', frescoes: 'Frescă', graphics: 'Grafică',
      viewer: 'Vizualizare lucrare', close: 'Închide',
      previous: 'Lucrarea precedentă', next: 'Lucrarea următoare',
      zoomIn: 'Mărește', zoomOut: 'Micșorează', reset: 'Resetează zoomul',
      enlarge: 'Vizualizează lucrarea în galerie', of: 'din'
    }
  }[lang];

  // Optional page scope: the main portfolio stays unfiltered, category pages reuse this same catalogue.
  const allowed = ['paintings', 'frescoes', 'graphics'];
  const scope = [...new Set((grid.dataset.r2Categories || '').split(',')
    .map(value => value.trim().toLowerCase()).filter(value => allowed.includes(value)))];
  const categories = ['all', ...(scope.length ? scope : allowed)];
  const pick = value => typeof value === 'string' ? value :
    value && typeof value === 'object' ? (value[lang] || value.en || value.ro || '') : '';

  function mediaUrl(value) {
    if (typeof value !== 'string') return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'media.soriniosub.com'
        ? url.href : '';
    } catch {
      return '';
    }
  }

  function categoryOf(value) {
    const key = typeof value === 'string' ? value.toLowerCase().trim() : '';
    return ({
      painting: 'paintings', paintings: 'paintings', pictura: 'paintings',
      fresco: 'frescoes', frescos: 'frescoes', frescoes: 'frescoes', fresca: 'frescoes',
      graphic: 'graphics', graphics: 'graphics', grafica: 'graphics'
    })[key] || key;
  }

  function detailsOf(work) {
    return [
      l[work._category] || '',
      Number.isInteger(work.year) ? String(work.year) : '',
      pick(work.technique),
      work.dimensionsCm && Number.isFinite(work.dimensionsCm.width)
        && Number.isFinite(work.dimensionsCm.height)
        ? work.dimensionsCm.width + ' × ' + work.dimensionsCm.height + ' cm' : ''
    ].filter(Boolean).join(' · ') || l.pending;
  }

  function textNode(tag, value, cls) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    node.textContent = value;
    return node;
  }

  function makeButton(text, label, cls, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = cls;
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', handler);
    return button;
  }

  const filters = document.createElement('div');
  filters.className = 'artwork-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', l.filters);
  filters.hidden = true;
  grid.before(filters);

  let allWorks = [];
  let visibleWorks = [];
  let selectedCategory = 'all';
  let modal;
  let modalImage;
  let modalTitle;
  let modalDetails;
  let modalCounter;
  let prevButton;
  let nextButton;
  let zoomOutButton;
  let zoomInButton;
  let zoomResetButton;
  let currentIndex = 0;
  let zoom = 1;
  let returnFocus = null;
  let previousOverflow = '';

  function showNotice(message, retry) {
    grid.replaceChildren(textNode('p', message, 'artwork-message'));
    if (retry) {
      grid.append(makeButton(l.retry, l.retry, 'artwork-retry', load));
    }
    grid.setAttribute('aria-busy', 'false');
  }

  function zoomTo(value) {
    zoom = Math.max(1, Math.min(3, Math.round(value * 100) / 100));
    if (!modalImage) return;
    modalImage.style.transform = 'scale(' + zoom + ')';
    zoomOutButton.disabled = zoom <= 1;
    zoomInButton.disabled = zoom >= 3;
    zoomResetButton.textContent = Math.round(zoom * 100) + '%';
  }

  function showModalImage() {
    const work = visibleWorks[currentIndex];
    if (!work || !modal) return;
    modalImage.src = work._full;
    modalImage.alt = pick(work.alt) || pick(work.title) || '';
    modalTitle.textContent = pick(work.title) || work.id || (lang === 'ro' ? 'Fără titlu' : 'Untitled');
    modalDetails.textContent = detailsOf(work);
    modalCounter.textContent = (currentIndex + 1) + ' ' + l.of + ' ' + visibleWorks.length;
    prevButton.disabled = visibleWorks.length < 2;
    nextButton.disabled = visibleWorks.length < 2;
    zoomTo(1);
  }

  function navigate(step) {
    if (!visibleWorks.length) return;
    currentIndex = (currentIndex + step + visibleWorks.length) % visibleWorks.length;
    showModalImage();
  }

  function ensureModal() {
    if (modal) return;
    modal = document.createElement('dialog');
    modal.className = 'art-lightbox';
    modal.setAttribute('aria-label', l.viewer);

    const panel = document.createElement('div');
    panel.className = 'art-lightbox-panel';
    const top = document.createElement('div');
    top.className = 'art-lightbox-top';
    modalCounter = textNode('span', '', 'art-lightbox-counter');
    const closeButton = makeButton('×', l.close, 'art-lightbox-button art-lightbox-close', () => modal.close());
    top.append(modalCounter, closeButton);

    const stage = document.createElement('div');
    stage.className = 'art-lightbox-stage';
    prevButton = makeButton('‹', l.previous, 'art-lightbox-button art-lightbox-prev', () => navigate(-1));
    nextButton = makeButton('›', l.next, 'art-lightbox-button art-lightbox-next', () => navigate(1));
    const imageArea = document.createElement('div');
    imageArea.className = 'art-lightbox-image-area';
    modalImage = document.createElement('img');
    modalImage.className = 'art-lightbox-image';
    modalImage.decoding = 'async';
    modalImage.addEventListener('dblclick', () => zoomTo(zoom === 1 ? 2 : 1));
    imageArea.append(modalImage);
    stage.append(prevButton, imageArea, nextButton);

    const bottom = document.createElement('div');
    bottom.className = 'art-lightbox-bottom';
    const caption = document.createElement('div');
    caption.className = 'art-lightbox-caption';
    modalTitle = textNode('h3', '');
    modalDetails = textNode('p', '');
    caption.append(modalTitle, modalDetails);
    const zoomControls = document.createElement('div');
    zoomControls.className = 'art-lightbox-zoom';
    zoomOutButton = makeButton('−', l.zoomOut, 'art-lightbox-button', () => zoomTo(zoom - 0.5));
    zoomResetButton = makeButton('100%', l.reset, 'art-lightbox-button art-lightbox-reset', () => zoomTo(1));
    zoomInButton = makeButton('+', l.zoomIn, 'art-lightbox-button', () => zoomTo(zoom + 0.5));
    zoomControls.append(zoomOutButton, zoomResetButton, zoomInButton);
    bottom.append(caption, zoomControls);

    panel.append(top, stage, bottom);
    modal.append(panel);
    document.body.append(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal) modal.close();
    });
    modal.addEventListener('close', () => {
      document.body.style.overflow = previousOverflow;
      modalImage.removeAttribute('src');
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    });
    modal.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
      else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomTo(zoom + 0.5); }
      else if (event.key === '-') { event.preventDefault(); zoomTo(zoom - 0.5); }
      else if (event.key === '0') { event.preventDefault(); zoomTo(1); }
    });
  }

  function openLightbox(index, trigger) {
    ensureModal();
    currentIndex = index;
    returnFocus = trigger;
    showModalImage();
    if (typeof modal.showModal === 'function') {
      previousOverflow = document.body.style.overflow;
      modal.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      window.open(visibleWorks[index]._full, '_blank', 'noopener,noreferrer');
    }
  }

  function makeCard(work, index) {
    const card = document.createElement('article');
    card.className = 'art-card artwork-from-r2';
    const link = document.createElement('a');
    link.className = 'art-frame real-artwork';
    link.href = work._full;
    link.setAttribute('aria-label', l.enlarge + ': ' + (pick(work.title) || work.id || ''));
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openLightbox(index, link);
    });

    const img = document.createElement('img');
    img.src = work._thumbnail;
    img.alt = pick(work.alt) || pick(work.title) || '';
    img.loading = index < 3 ? 'eager' : 'lazy';
    img.decoding = 'async';
    link.append(img);

    const info = document.createElement('div');
    info.className = 'art-info';
    const content = document.createElement('div');
    content.append(textNode('h3', pick(work.title) || work.id || (lang === 'ro' ? 'Fără titlu' : 'Untitled')));
    content.append(textNode('p', detailsOf(work), 'artwork-meta'));
    const description = pick(work.description);
    if (description) content.append(textNode('p', description, 'artwork-description'));
    info.append(content);
    card.append(link, info);
    return card;
  }

  function renderGrid() {
    visibleWorks = selectedCategory === 'all'
      ? allWorks : allWorks.filter(item => item._category === selectedCategory);
    grid.replaceChildren();
    if (!visibleWorks.length) {
      showNotice(selectedCategory === 'all' && !scope.length ? l.empty : l.noResults, false);
    } else {
      visibleWorks.forEach((work, index) => grid.append(makeCard(work, index)));
      grid.setAttribute('aria-busy', 'false');
    }
  }

  function renderFilters() {
    filters.replaceChildren();
    for (const category of categories) {
      const total = category === 'all' ? allWorks.length
        : allWorks.filter(work => work._category === category).length;
      const label = (l[category] || category) + ' (' + total + ')';
      const button = makeButton(label, label, 'artwork-filter', () => {
        selectedCategory = category;
        renderFilters();
        renderGrid();
      });
      button.setAttribute('aria-pressed', String(selectedCategory === category));
      filters.append(button);
    }
    filters.hidden = allWorks.length === 0 || categories.length <= 2;
  }

  async function load() {
    filters.hidden = true;
    grid.setAttribute('aria-busy', 'true');
    grid.replaceChildren(textNode('p', l.loading, 'artwork-message'));
    try {
      const response = await fetch(catalogueUrl, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const catalogue = await response.json();
      if (!catalogue || catalogue.schemaVersion !== 1 || !Array.isArray(catalogue.artworks)) {
        throw new Error('Unexpected catalogue format');
      }
      allWorks = catalogue.artworks.filter(work => work && work.published !== false)
        .map(work => ({
          ...work,
          _category: categoryOf(work.category),
          _thumbnail: mediaUrl(work.images && work.images.thumbnail),
          _full: mediaUrl(work.images && work.images.full)
        }))
        .filter(work => work._thumbnail && work._full)
        .filter(work => !scope.length || scope.includes(work._category));
      selectedCategory = 'all';
      renderFilters();
      renderGrid();
    } catch (error) {
      console.warn('R2 artwork catalogue unavailable:', error);
      showNotice(l.unavailable, true);
    }
  }

  load();
})();
