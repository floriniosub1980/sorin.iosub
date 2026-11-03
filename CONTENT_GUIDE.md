# Adding artworks to Sorin Iosub's website

The live website is served from the static root `en/` and `ro/` folders on GitHub Pages. The Astro files in `src/` mirror these pages.

## Where files go (Cloudflare R2)
Bucket: `sorin-iosub-media`; public hostname: `https://media.soriniosub.com`.

- Painting: `artworks/paintings/<unique-slug>/thumbnail.webp` and `full.webp`
- Drawing and graphics: `artworks/graphics/<unique-slug>/thumbnail.webp` and `full.webp`
- Frescoes / monumental projects: `artworks/frescoes/<unique-slug>/thumbnail.webp` and `full.webp`
- Catalogue: `data/artworks.json`

Each new artwork is a separate entry under `artworks` in `data/artworks.json`. Set `category` to `paintings`, `graphics`, or `frescoes`. Provide both `images.thumbnail` and `images.full` as HTTPS URLs on the media hostname and set `published` to `true`.

The homepage portfolio (`/en/#artworks` and `/ro/#artworks`) shows all published works. The two practice category galleries automatically filter the **same** JSON:

- `/en/painting-drawing/`, `/ro/pictura-desen/`: `paintings` + `graphics`
- `/en/frescoes-monumental/`, `/ro/fresce-monumentale/`: `frescoes`

A missing category will show an empty state until an artwork is published; there is no need to edit GitHub when adding images. **Validate JSON before replacing the live catalogue**. Invalid JSON blocks every gallery.
