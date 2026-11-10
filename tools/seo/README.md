# SEO automation — Sorin Iosub

This site uses GitHub Pages (static root files) and Cloudflare R2 (`data/artworks.json` and WebP images).

The Node 22 script `tools/seo/generate.mjs` generates RO/EN artwork pages:
- `/en/artworks/<id>/`
- `/ro/lucrari/<id>/`
and root `robots.txt`, `sitemap.xml` (including images hosted on R2), with mirrors under `public/` for Astro.

Automatic sync: GitHub Actions `Sync artwork SEO from R2` runs twice an hour or manually from the Actions tab. Some scheduled runs may be delayed. Each run fetches the **live** R2 catalogue. If R2 fails or catalogue structure is invalid, the action stops before changing any pages. Published=false entries are removed on successful sync.

Offline regeneration: `node tools/seo/generate.mjs --catalogue path/to/artworks.json`. Do not use `downloads/artworks_6_lucrari.json` as a substitute for the actual published catalog; the initial generated pages use this old 6-work snapshot only until live synchronization.

## Google Search Console — one-time manual setup
1. https://search.google.com/search-console — add a **Domain property** `soriniosub.com`.
2. Verify via a DNS TXT record in Cloudflare; a domain property covers the media subdomain too.
3. Submit `https://soriniosub.com/sitemap.xml`, test a few detail pages and monitor the indexing report.
4. Confirm artwork names, artist biography, artist credits and image licensing information before adding further structured metadata.
