# Sorin Iosub — Artist Portfolio (first draft)

Bilingual (English / Romanian), responsive, static portfolio built with Astro. The site contains concept artwork placeholders, not reproductions of the artist's paintings.

## Run locally

```bash
npm install
npm run dev
npm run build
```

## Deploy with Cloudflare Pages

Connect this GitHub repository at **Cloudflare → Workers & Pages → Create → Pages → Connect to Git**.
- Framework preset: Astro
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: repository root

Set `soriniosub.com` as the custom domain after purchasing and configuring its DNS. This does not happen automatically when committing code.

## Current state

- ✅ Original, mobile-responsive design with EN/RO language routes
- ✅ Sections: selected artworks, practice, exhibitions, about, contact
- ✅ Source link to the public Facebook profile
- ✅ No false claims that artworks, contact email or prices have been verified
- ⚠️ Colored artwork panels are demonstrative placeholders; they are **not** Sorin Iosub's paintings
- ⚠️ Contact and price inquiry are not functional until the artist supplies an approved address and backend/form service is configured
- ⚠️ Facebook blocks full automated profile reading; biographical and exhibition material requires artist review
- ⚠️ Google Drive / R2 media synchronization is a future integration

## Future Google Drive import

Suggested folder convention:

```text
Artworks/SI-0001/cover.jpg
Artworks/SI-0001/detail-01.jpg
Artworks/SI-0001/descriere.txt
```

An incremental importer can validate TXT metadata and write a generated catalog while uploading authorized optimized photo derivatives to Cloudflare R2. Keep Drive credentials in repository secrets, never in source control.

## Editorial verification

Before launch, verify with the artist: biography, work titles, exhibition descriptions, image rights, and contact details. Historical public references to check include the 2026 exhibition at Muzeul Apei in Timișoara and the 2015 “40 / Metafora” exhibition. Artist profile: https://www.facebook.com/sorin.iosub.9/?locale=ro_RO

## Mobile responsive support

- Touch-friendly collapsible navigation (native HTML details + minimal progressive-enhancement script)
- Dedicated breakpoints at 900, 640, 420 and 360 px; gallery grids adapt from three to two to one column
- Fluid typography, horizontal-overflow protection, sticky mobile header and safe tap areas
- Reduced-motion support and visible keyboard focus
- Both published root HTML pages and Astro source share the same responsive styles
- Verify on real devices before launch, particularly landscape mode and accessibility with screen readers

## Sticky navigation and arrow-free interface

- Header remains visible while scrolling on desktop, tablet and mobile.
- Anchor scroll offsets account for the header.
- Decorative arrows have been removed; exhibition source and back-to-top links retain descriptive text.
