/* Bilingual, accessible endorsements for Sorin Iosub.
   Content is published from /data/testimonials.json. Empty catalogue remains honest. */
(() => {
  'use strict';
  const container = document.querySelector('[data-testimonials]');
  if (!container) return;

  const lang = container.dataset.testimonials === 'en' ? 'en' : 'ro';
  const emptyText = {
    ro: 'Recomandările și mărturiile despre activitatea artistului vor fi publicate aici.',
    en: 'Endorsements and reflections on the artist’s work will be published here.'
  };
  const summaryLabel = {ro: 'Sinteză editorială a textului critic', en: 'Editorial summary of the critical text'};
  const list = container.querySelector('.testimonials-list');
  const empty = container.querySelector('.testimonials-empty');
  if (!list || !empty) return;

  function localized(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    if (Object.prototype.hasOwnProperty.call(value,lang)) {
      return typeof value[lang] === 'string' ? value[lang] : '';
    }
    return typeof value[lang === 'ro' ? 'en' : 'ro'] === 'string'
      ? value[lang === 'ro' ? 'en' : 'ro'] : '';
  }

  function makeText(tag, content, className) {
    const el = document.createElement(tag);
    el.textContent = content;
    if (className) el.className = className;
    return el;
  }

  async function render() {
    try {
      const response = await fetch('/data/testimonials.json', {cache: 'no-store'});
      if (!response.ok) throw new Error('Testimonials HTTP ' + response.status);
      const data = await response.json();
      if (data?.schemaVersion !== 1 || !Array.isArray(data.testimonials)) {
        throw new Error('Invalid testimonials catalogue');
      }

      const published = data.testimonials.filter(item =>
        item && item.published === true &&
        localized(item.quote)?.trim() && typeof item.author === 'string' && item.author.trim()
      );
      const fragment = document.createDocumentFragment();
      for (const item of published) {
        const quote = localized(item.quote).trim();
        const article = document.createElement('article');
        article.className = 'testimonial-card';
        const isSummary = item.format === 'editorial_summary';
        const block = document.createElement(isSummary ? 'div' : 'blockquote');
        block.className = 'testimonial-quote';
        quote.split(/\\n\\s*\\n/).filter(Boolean).forEach(paragraph => {
          block.append(makeText('p', paragraph.trim(), 'testimonial-paragraph'));
        });
        const author = makeText('p', item.author.trim(), 'testimonial-author');
        if (isSummary) article.append(makeText('p', summaryLabel[lang], 'testimonial-format'));
        article.append(block,author);
        const title = localized(item.role);
        if (title.trim()) article.append(makeText('p',title.trim(),'testimonial-role'));
        fragment.append(article);
      }
      list.replaceChildren(fragment);
      empty.hidden = published.length > 0;
      list.hidden = published.length === 0;
    } catch (error) {
      // Do not replace published material with invented endorsements.
      console.warn('Testimonials data unavailable:', error);
      empty.hidden = false;
      list.hidden = true;
      empty.textContent = emptyText[lang];
    }
  }

  render();
})();
