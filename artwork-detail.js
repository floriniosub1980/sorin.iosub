/* Refresh static artwork detail pages from the live Cloudflare R2 catalogue.
   Static HTML remains a searchable and usable fallback when R2 is unavailable. */
(() => {
  'use strict';

  const route = location.pathname.match(/^\/(en\/artworks|ro\/lucrari)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|\/index\.html)?$/);
  if (!route || route[2] === 'view') return;
  const textBox = document.querySelector('.seo-artwork-text');
  const heading = textBox?.querySelector('h1');
  if (!heading) return;

  const id = route[2];
  const lang = route[1].startsWith('en') ? 'en' : 'ro';
  const otherLang = lang === 'en' ? 'ro' : 'en';
  const text = lang === 'en' ? {
    painting: 'Painting', graphics: 'Graphic art', frescoes: 'Fresco',
    paintingGroup: 'Painting & drawing', frescoGroup: 'Frescoes & monumental projects',
    fullImage: 'View full image',
    descriptionFallback: 'Artwork from the Sorin Iosub portfolio.'
  } : {
    painting: 'Pictură', graphics: 'Grafică', frescoes: 'Frescă',
    paintingGroup: 'Pictură și desen', frescoGroup: 'Frescă și proiecte monumentale',
    fullImage: 'Vezi imaginea completă',
    descriptionFallback: 'Lucrare din portofoliul lui Sorin Iosub.'
  };

  function localized(value) {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object') return '';
    // An explicitly cleared translation must remain empty, not fall back
    // to the other language's previous description.
    if (Object.prototype.hasOwnProperty.call(value, lang)) {
      return typeof value[lang] === 'string' ? value[lang].trim() : '';
    }
    return typeof value[otherLang] === 'string' ? value[otherLang].trim() : '';
  }


  // Keep the live metadata in sync with the static SEO generator.
  function seoSnippet(work,title,authored,otherWorks) {
    if(authored)return authored;
    const kind={
      paintings:lang==='en'?'Painting':'Pictură',
      graphics:lang==='en'?'Graphic art':'Grafică',
      frescoes:lang==='en'?'Fresco':'Frescă'
    }[work.category]||(lang==='en'?'Artwork':'Lucrare');
    const technique=localized(work.technique);
    const dim=work.dimensionsCm;
    const size=Number.isFinite(dim?.width)&&Number.isFinite(dim?.height)
      ?dim.width+' × '+dim.height+' cm':'';
    const facts=[Number.isInteger(work.year)?String(work.year):'',size].filter(Boolean);
    const repeated=otherWorks.some(other=>other.id!==work.id&&
      localized(other.title).toLocaleLowerCase(lang)===title.trim().toLocaleLowerCase(lang));
    const first=(lang==='en'?'“':'„')+title+'” — '+(technique||kind)+
      (lang==='en'?' by Sorin Iosub':' de Sorin Iosub')+
      (facts.length?' ('+facts.join(', ')+')':'')+'. ';
    const second=lang==='en'?'View the artwork and details in the artist’s portfolio.':
      'Vezi imaginea și detaliile lucrării în portofoliul artistului.';
    const ref=repeated?' '+(lang==='en'?'Catalogue reference: ':'Referință catalog: ')+
      work.id.toUpperCase()+'.':'';
    return first+second+ref;
  }

  function mediaUrl(value) {
    if (typeof value !== 'string') return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' &&
        url.hostname === 'media.soriniosub.com' &&
        url.pathname.startsWith('/artworks/') &&
        url.pathname.endsWith('.webp') ? url.href : '';
    } catch {
      return '';
    }
  }

  function updateMeta(selector, content) {
    const element = document.querySelector(selector);
    if (element) element.setAttribute('content', content);
  }

  function updateStructuredData(work, title, description, alt, full, generic) {
    const el = document.querySelector('script[type="application/ld+json"]');
    if (!el) return;
    try {
      const data = JSON.parse(el.textContent);
      if (!Array.isArray(data['@graph'])) return;
      for (const entity of data['@graph']) {
        if (entity['@type'] === 'VisualArtwork') {
          entity.name = title;
          entity.description = description || generic;
          if (Number.isInteger(work.year)) entity.dateCreated = String(work.year);
          else delete entity.dateCreated;
          const medium = localized(work.technique);
          if (medium) entity.artMedium = medium;
          else delete entity.artMedium;
        } else if (entity['@type'] === 'ImageObject') {
          entity.contentUrl = full;
          entity.caption = alt;
        } else if (entity['@type'] === 'WebPage') {
          entity.name = title;
        }
      }
      el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    } catch (error) {
      console.warn('Invalid artwork structured data:', error);
    }
  }

  function refresh(work, catalogWorks) {
    const title = localized(work.title) || id;
    const description = localized(work.description);
    const alt = localized(work.alt) || title;
    const full = mediaUrl(work.images?.full);
    if (!full) return;
    const cat = String(work.category || '').toLowerCase().trim();
    const fresco = ['frescoes', 'fresco', 'fresca'].includes(cat);
    const graphic = ['graphics', 'graphic', 'grafica'].includes(cat);
    const categoryName = fresco ? text.frescoes : graphic ? text.graphics : text.painting;
    const groupName = fresco ? text.frescoGroup : text.paintingGroup;
    const categoryPath = fresco
      ? (lang === 'en' ? '/en/frescoes-monumental/' : '/ro/fresce-monumentale/')
      : (lang === 'en' ? '/en/painting-drawing/' : '/ro/pictura-desen/');
    const dimensions = work.dimensionsCm;
    const size = dimensions && Number.isFinite(dimensions.width) &&
      Number.isFinite(dimensions.height)
      ? dimensions.width + ' × ' + dimensions.height + ' cm' : '';
    const metadata = [categoryName, Number.isInteger(work.year) ? String(work.year) : '',
      localized(work.technique), size].filter(Boolean).join(' · ');

    heading.textContent = title;
    document.title = title + ' — Sorin Iosub | ' + groupName;

    const eyebrow = textBox.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = 'SORIN IOSUB / ' + groupName;

    let metadataEl = textBox.querySelector('.seo-artwork-meta');
    if (!metadataEl && metadata) {
      metadataEl = document.createElement('p');
      metadataEl.className = 'seo-artwork-meta';
      heading.after(metadataEl);
    }
    if (metadataEl) {
      metadataEl.textContent = metadata;
      metadataEl.hidden = !metadata;
    }

    let descriptionEl = textBox.querySelector('.seo-artwork-description');
    if (description) {
      if (!descriptionEl) {
        descriptionEl = document.createElement('p');
        descriptionEl.className = 'seo-artwork-description';
        const actions = textBox.querySelector('.seo-artwork-actions');
        if (actions) actions.before(descriptionEl);
        else textBox.append(descriptionEl);
      }
      descriptionEl.textContent = description;
      descriptionEl.hidden = false;
    } else if (descriptionEl) {
      descriptionEl.remove();
    }

    const figure = document.querySelector('.seo-artwork-figure');
    const figureLink = figure?.querySelector('a');
    const picture = figure?.querySelector('img');
    if (figureLink) {
      figureLink.href = full;
      figureLink.setAttribute('aria-label', text.fullImage + ': ' + title);
    }
    if (picture) {
      picture.src = full;
      picture.alt = alt;
    }
    const actionLinks = textBox.querySelectorAll('.seo-artwork-actions a');
    if (actionLinks[0]) {
      actionLinks[0].href = full;
      actionLinks[0].textContent = text.fullImage;
    }
    if (actionLinks[1]) {
      actionLinks[1].href = categoryPath;
      actionLinks[1].textContent = groupName;
    }

    const breadcrumb = document.querySelector('.seo-breadcrumb');
    if (breadcrumb) {
      const links = breadcrumb.querySelectorAll('a');
      if (links.length >= 2) {
        links[1].href = categoryPath;
        links[1].textContent = groupName;
        breadcrumb.replaceChildren(links[0], document.createTextNode(' / '), links[1],
          document.createTextNode(' / ' + title));
      }
    }

    const seoDescription = seoSnippet(work, title, description, catalogWorks);
    updateMeta('meta[name="description"]', seoDescription);
    updateMeta('meta[property="og:title"]', title + ' — Sorin Iosub');
    updateMeta('meta[property="og:description"]', seoDescription);
    updateMeta('meta[property="og:image"]', full);
    updateMeta('meta[property="og:image:alt"]', alt);
    updateStructuredData(work, title, description, alt, full, seoDescription);
  }

  async function run() {
    try {
      const response = await fetch('https://media.soriniosub.com/data/artworks.json', {
        mode: 'cors', cache: 'no-store'
      });
      if (!response.ok) throw new Error('Catalogue HTTP ' + response.status);
      const catalog = await response.json();
      if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.artworks)) {
        throw new Error('Invalid R2 catalogue');
      }
      const work = catalog.artworks.find(item =>
        item && item.id === id && item.published !== false);
      if (work) refresh(work, catalog.artworks.filter(item => item && item.published !== false));
    } catch (error) {
      // Keep the static page intact if there is a transient R2/CORS outage.
      console.warn('Artwork detail refresh failed; using static HTML:', error);
    }
  }

  run();
})();
