# Sorin Iosub — Artist Portfolio (first draft)

Bilingual (English / Romanian), responsive, static portfolio built with Astro. The site contains concept artwork placeholders, not reproductions of the artist's paintings.

## Run locally

```bash
npm install
npm run dev
npm run build
```

## GitHub Pages and custom domain: soriniosub.com

The current public preview is a static site in the repository root (`index.html`, `en/`, `ro/`, `style.css`). Configure GitHub repository **Settings → Pages**:
- Source: `Deploy from a branch`
- Branch: `main`, folder: `/ (root)`
- Custom domain: `soriniosub.com` (save; repository-root `CNAME` also declares it)
- Enable **Enforce HTTPS** once GitHub has verified DNS and issued its TLS certificate.

In the authoritative DNS zone for `soriniosub.com` at Hostico, use these records:

| Host | Type | Value |
| --- | --- | --- |
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |
| `www` | `CNAME` | `floriniosub1980.github.io` |

Preserve any MX/TXT records needed for email and remove conflicting parking/old A or AAAA records for the same host. Some control panels use a blank host rather than `@`. DNS propagation and GitHub TLS provisioning can take time (up to about 24 hours or longer for TLS).

The canonical URLs of the public HTML pages are set to the custom domain. All internal navigation uses relative paths, so the two languages work under the new domain. `public/CNAME` is retained for a future Astro build/deploy workflow; the current Pages source is the root branch.

GitHub Pages is a static site host; artwork inquiry email needs a third-party form service or serverless endpoint. Because this art portfolio includes commercial inquiries, review GitHub Pages usage terms before treating Pages as a permanent commercial deployment. Cloudflare Pages remains the proposed production alternative if needed.

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
