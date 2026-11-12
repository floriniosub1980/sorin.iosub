import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function build(catalog) {
  const domain="https://soriniosub.com",host="https://media.soriniosub.com";
  const e=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const pick=(x,l)=>typeof x==="string"?x:x?.[l]||x?.ro||x?.en||"";
  const detail=(l,id)=>"/"+l+"/"+(l==="en"?"artworks":"lucrari")+"/"+id+"/";
  const section=(l,category)=>category==="frescoes"?(l==="en"?"/en/frescoes-monumental/":"/ro/fresce-monumentale/"):(l==="en"?"/en/painting-drawing/":"/ro/pictura-desen/");
  if(catalog?.schemaVersion!==1||!Array.isArray(catalog.artworks))throw Error("Invalid catalog schema");
  const files={},seen=new Set();
  // Progressive enhancement: static cards are crawlable and remain usable without JS.
  const galleryPages = [
    {path:'en/index.html',lang:'en',cats:[]},
    {path:'ro/index.html',lang:'ro',cats:[]},
    {path:'en/painting-drawing/index.html',lang:'en',cats:['paintings','graphics']},
    {path:'ro/pictura-desen/index.html',lang:'ro',cats:['paintings','graphics']},
    {path:'en/frescoes-monumental/index.html',lang:'en',cats:['frescoes']},
    {path:'ro/fresce-monumentale/index.html',lang:'ro',cats:['frescoes']}
  ];
  const markerStart='<!-- SEO-ARTWORKS:START -->';
  const markerEnd='<!-- SEO-ARTWORKS:END -->';
  const published=catalog.artworks.filter(w=>w && w.published!==false);
  function staticArtworkCard(work,lang,index) {
    const name=pick(work.title,lang);
    const alt=pick(work.alt,lang)||name;
    const link=detail(lang,work.id);
    const categoryNames=lang==='ro'?
      {paintings:'Pictură',graphics:'Grafică',frescoes:'Frescă'}:
      {paintings:'Painting',graphics:'Graphic art',frescoes:'Fresco'};
    const subtitle=[categoryNames[work.category],Number.isInteger(work.year)?String(work.year):'',pick(work.technique,lang)].filter(Boolean).join(' · ');
    const label=lang==='ro'?'Detalii despre lucrare':'Artwork details';
    const loading=index<3?'eager':'lazy';
    return '<article class="art-card artwork-from-r2 artwork-seo-static">\n'+
      '<a class="art-frame real-artwork" href="'+link+'" aria-label="'+e(label+': '+name)+'">\n'+
      '<img src="'+e(work.images.thumbnail)+'" alt="'+e(alt)+'" loading="'+loading+'" decoding="async"></a>\n'+
      '<div class="art-info"><div><h3><a href="'+link+'">'+e(name)+'</a></h3>'+
      '<p class="artwork-meta">'+e(subtitle)+'</p>'+
      '<a class="artwork-details-link" href="'+link+'">'+label+'</a></div></div></article>';
  }
  const sitePages=["/en/","/ro/","/en/painting-drawing/","/ro/pictura-desen/","/en/frescoes-monumental/","/ro/fresce-monumentale/"].map(p=>({p}));
  for(const w of catalog.artworks.filter(x=>x&&x.published!==false)){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(w.id)||seen.has(w.id))throw Error("Invalid/duplicate ID "+w.id);
    seen.add(w.id);
    if(!["paintings","graphics","frescoes"].includes(w.category))throw Error("Invalid category for "+w.id);
    for(const key of ["full","thumbnail"])if(typeof w.images?.[key]!=="string"||!w.images[key].startsWith(host+"/artworks/")||!w.images[key].endsWith(".webp"))throw Error("Invalid R2 image "+w.id);
    for(const lang of ["en","ro"]) {
      const other=lang==="en"?"ro":"en",p=detail(lang,w.id),absolute=domain+p;
      const title=pick(w.title,lang),description=pick(w.description,lang),alt=pick(w.alt,lang)||title;
      if(!title)throw Error("Missing title "+w.id);
      const en=lang==="en",category=w.category==="frescoes"?(en?"Frescoes & monumental projects":"Frescă și proiecte monumentale"):(en?"Painting & drawing":"Pictură și desen");
      const fallback=en?"Artwork from the Sorin Iosub portfolio.":"Lucrare din portofoliul lui Sorin Iosub.";
      const excerpt=description||fallback;
      const metadata=[w.category==="frescoes"?(en?"Fresco":"Frescă"):w.category==="graphics"?(en?"Graphic art":"Grafică"):(en?"Painting":"Pictură"),Number.isInteger(w.year)?w.year:"",pick(w.technique,lang),Number.isFinite(w.dimensionsCm?.width)&&Number.isFinite(w.dimensionsCm?.height)?`${w.dimensionsCm.width} × ${w.dimensionsCm.height} cm`:""].filter(Boolean).join(" · ");
      const artwork={"@type":"VisualArtwork","@id":absolute+"#artwork","name":title,"description":excerpt,"url":absolute,"inLanguage":lang,"creator":{"@id":domain+"/#artist"},"image":{"@id":absolute+"#image"}};
      if(Number.isInteger(w.year))artwork.dateCreated=String(w.year);
      if(pick(w.technique,lang))artwork.artMedium=pick(w.technique,lang);
      const schema={"@context":"https://schema.org","@graph":[{"@type":"Person","@id":domain+"/#artist","name":"Sorin Iosub","url":domain+"/en/"},{"@type":"ImageObject","@id":absolute+"#image","contentUrl":w.images.full,"caption":alt,"creditText":"Artwork: Sorin Iosub"},artwork,{"@type":"WebPage","@id":absolute+"#page","url":absolute,"name":title,"mainEntity":{"@id":absolute+"#artwork"},"primaryImageOfPage":{"@id":absolute+"#image"},"inLanguage":lang}]};
      const text=en?{home:"Portfolio",practice:"Practice",contact:"Contact",about:"About",view:"View full image",more:"Other artworks",notes:"Details to be confirmed with the artist",language:"Română",rights:"Artwork imagery remains the property of its respective rights holders."}:{home:"Portofoliu",practice:"Practica artistică",contact:"Contact",about:"Despre",view:"Vezi imaginea completă",more:"Alte lucrări",notes:"Detalii în curs de confirmare cu artistul",language:"English",rights:"Imaginile lucrărilor rămân proprietatea deținătorilor drepturilor."};
      files[p.slice(1)+"index.html"]=`<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)} — Sorin Iosub | ${e(category)}</title>
<meta name="description" content="${e(excerpt.slice(0,300))}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#f6f4ef">
<link rel="canonical" href="${absolute}">
<link rel="alternate" hreflang="en" href="${domain+detail("en",w.id)}">
<link rel="alternate" hreflang="ro" href="${domain+detail("ro",w.id)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Sorin Iosub">
<meta property="og:locale" content="${en?"en_US":"ro_RO"}">
<meta property="og:title" content="${e(title)} — Sorin Iosub">
<meta property="og:description" content="${e(excerpt.slice(0,300))}">
<meta property="og:url" content="${absolute}">
<meta property="og:image" content="${e(w.images.full)}">
<meta property="og:image:alt" content="${e(alt)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="${host}">
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/responsive.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@400;500&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,"\\u003c")}</script>
</head><body>
<a class="skip" href="#content">${en?"Skip to content":"Sari la conținut"}</a>
<header class="site-header"><a class="brand" href="/${lang}/">SORIN <span>IOSUB</span></a>
<nav aria-label="${en?"Main navigation":"Navigare principală"}">
<a href="/${lang}/#artworks">${text.home}</a><a href="/${lang}/#practice">${text.practice}</a><a href="/${lang}/#about">${text.about}</a><a href="/${lang}/#contact">${text.contact}</a></nav>
<a class="lang" href="${detail(other,w.id)}"><img class="language-flag" src="/flags/${other==="ro"?"ro":"gb"}.svg" width="22" height="15" alt="" aria-hidden="true"> ${text.language}</a>
<details class="mobile-menu"><summary aria-label="${en?"Open navigation":"Deschide meniul"}"><span class="menu-label">${en?"Menu":"Meniu"}</span><span class="menu-lines" aria-hidden="true"><span></span><span></span></span></summary>
<nav aria-label="${en?"Mobile navigation":"Navigare mobilă"}"><a href="/${lang}/#artworks">${text.home}</a><a href="/${lang}/#practice">${text.practice}</a><a href="/${lang}/#about">${text.about}</a><a href="/${lang}/#contact">${text.contact}</a><a class="mobile-language" href="${detail(other,w.id)}">${text.language}</a></nav></details>
</header>
<main id="content" class="seo-artwork-page"><section class="section-pad seo-artwork-content">
<nav class="seo-breadcrumb"><a href="/${lang}/#artworks">${text.home}</a> / <a href="${section(lang,w.category)}">${e(category)}</a> / ${e(title)}</nav>
<div class="seo-artwork-layout"><div class="seo-artwork-figure"><a href="${e(w.images.full)}" target="_blank" rel="noopener noreferrer" aria-label="${text.view}: ${e(title)}"><img src="${e(w.images.full)}" alt="${e(alt)}" loading="eager" decoding="async" fetchpriority="high"></a></div>
<div class="seo-artwork-text"><p class="eyebrow">SORIN IOSUB / ${e(category)}</p><h1>${e(title)}</h1>
${metadata?`<p class="seo-artwork-meta">${e(metadata)}</p>`:""}
<p class="seo-artwork-description">${e(description||text.notes)}</p>
<div class="seo-artwork-actions"><a href="${e(w.images.full)}" target="_blank" rel="noopener noreferrer">${text.view}</a><a href="${section(lang,w.category)}">${e(category)}</a><a href="/${lang}/#artworks">${text.more}</a></div>
</div></div></section></main>
<footer class="site-footer"><span>© 2026 SORIN IOSUB</span><span>${text.rights}</span><a href="/${lang}/#artworks">${text.home}</a></footer>
<script src="/mobile.js" defer></script></body></html>
`;
      sitePages.push({p,image:w.images.full});
    }
  }
  // Only generate page markup after every published artwork has passed validation.
  if(!published.length)throw Error('Refusing to publish an empty R2 gallery');
  for(const page of galleryPages) {
    const target=path.join(root,page.path);
    const source=fs.readFileSync(target,'utf8');
    const a=source.indexOf(markerStart),b=source.indexOf(markerEnd);
    if(a<0||b<a||source.indexOf(markerStart,a+1)!==-1||source.indexOf(markerEnd,b+1)!==-1)
      throw Error('SEO gallery markers are missing or duplicated in '+page.path);
    const items=published.filter(work=>!page.cats.length||page.cats.includes(work.category));
    const fallback=page.lang==='ro'?'Nu sunt lucrări publicate în această categorie.':'No artworks published in this category.';
    const cards=items.length?items.map((work,index)=>staticArtworkCard(work,page.lang,index)).join('\n'):
      '<p class="artwork-message">'+fallback+'</p>';
    const pageMarkup=source.slice(0,a)+markerStart+'\n'+cards+'\n'+markerEnd+source.slice(b+markerEnd.length);
    files[page.path]=pageMarkup.replace(/(<div class="art-grid"[^>]*?)aria-busy="(?:true|false)"/,'$1aria-busy="false"');
  }
  const sitemap=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',...sitePages.map(v=>`<url><loc>${domain+v.p}</loc>${v.image?`<image:image><image:loc>${e(v.image)}</image:loc></image:image>`:""}</url>`),'</urlset>',''].join("\n");
  const robots="User-agent: *\nAllow: /\nSitemap: https://soriniosub.com/sitemap.xml\n";
  files["sitemap.xml"]=files["public/sitemap.xml"]=sitemap;
  files["robots.txt"]=files["public/robots.txt"]=robots;
  return files;
}
async function run(){
  const arg=process.argv.indexOf('--catalogue');
  let catalogue;
  if(arg>=0){if(!process.argv[arg+1])throw Error('Expected path after --catalogue');catalogue=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8'));}
  else {
    const response=await fetch('https://media.soriniosub.com/data/artworks.json',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('R2 catalogue HTTP '+response.status);
    const text=await response.text();
    if(text.length>8000000)throw Error('R2 catalogue too large');
    catalogue=JSON.parse(text);
  }
  const files=build(catalogue); // Fail closed: generate and validate all files before mutating.
  const wanted=new Set(Object.keys(files));
  for(const base of ['en/artworks','ro/lucrari']){
    const folder=path.join(root,base);
    if(fs.existsSync(folder))for(const dir of fs.readdirSync(folder,{withFileTypes:true})){
      if(!dir.isDirectory()||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dir.name))continue;
      if(!wanted.has(base+'/'+dir.name+'/index.html'))fs.rmSync(path.join(folder,dir.name),{recursive:true,force:true});
    }
  }
  for(const [name,body] of Object.entries(files)){
    const destination=path.join(root,name);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==body)fs.writeFileSync(destination,body);
  }
  console.log('SEO sync complete:',Object.keys(files).filter(x=>x.endsWith('index.html')).length,'artwork pages');
}
run().catch(error=>{console.error('SEO sync aborted (existing pages kept if catalogue load/validation failed):',error);process.exitCode=1;});
