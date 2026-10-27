---
version: 1
slug: "src-pages-guias-formacion-minera-gratuita-economica-peru-astro"
primary_target: "src/pages/guias/formacion-minera-gratuita-economica-peru.astro"
related_targets: ["src/layouts/GuideLayout.astro", "src/components/guides/TrainingGraphic.astro", "src/components/guides/GuideIcon.astro", "src/components/guides/TrainingOption.astro", "src/components/guides/TrainingNotes.astro", "src/styles/training-guide.css"]
---

# Surface brief — formación minera accesible en Perú

## Scope & mode

- Route: `/guias/formacion-minera-gratuita-economica-peru/`.
- Local URL: http://localhost:4321/guias/formacion-minera-gratuita-economica-peru/
- Mode: **Read**. Production-bound implementation of the selected Recorrido direction, extending the existing Labormin identity within this guide.
- Status: implemented and documented locally. Independent full-surface finish review returned **ship**, with no material findings; all 14 required captures were accepted. Deployment is not claimed.
- Historical selection: `.impeccable/mocks/formacion/DIRECTION.md`. Its prototype URLs, earlier variants and QA runs describe that prototype; this brief describes the real guide implementation.

## Audience, purpose & content contract

Peruvian readers with limited time and budget need to distinguish a short course, a practical trade and a technical career, then compare realistic costs and credentials before contacting a center. The three entry points are alternatives, without numbering or an implied compulsory sequence. Native anchors lead to `#cursos`, `#oficios` and `#carreras`; source links lead to the institutions and official references.

The opening “Hay más de una forma de empezar” pairs a short purpose statement and the existing source date with authored SVG diagrams: a learning screen, electrical practice and a study plan. A compact budget strip introduces materials, travel and credentials. The reading continues through seven institutions, credential comparison, four questions before paying, local directories, scholarships and research limits. This is a documentary selection, without a quality ranking, placement promise or new source-verification claim. The consultation date remains 26 October 2026.

`src/data/education.json` remains the source record. `TrainingOption.astro` holds separately authored, shorter summaries for program, cost, time, credential and availability. Each card retains the original name and location, and a native “Ver requisitos y datos completos” disclosure renders the original program, cost, duration, credential, admission and status fields. All seven records and their official/action/additional source links remain available. Summaries do not replace or write back into the JSON. Unconfirmed total costs, closed admissions, uncertain degrees and eligibility conditions remain explicit in the visible summaries as well as the full records.

## Direction & incumbent comparison

Authority compared: `PRODUCT.md`, `DESIGN.md`, `src/styles/global.css`, the previous guide and `GuideLayout.astro` at HEAD, and the original guide capture `/tmp/labormin-guide-original.png`. The current desktop and actual-user-width composition was also inspected in `.impeccable/review/training/chromium-1440.png` and `chromium-524.png`.

The original was a continuous prose article with a text contents list. This extension replaces its opening navigation with illustrated alternatives, gives the institutions separate reading surfaces, and moves the complete source wording into native disclosures. Graphite backgrounds, scarce amber accents, Fraunces headings, Inter body/UI text, rounded surfaces, shared header/footer and the guide breadcrumb remain incumbent Labormin vocabulary. The semantic page title and Peru/Spanish context remain explicit.

The desktop hero uses two columns; the chooser uses three. Course/trade cards use two columns, while the longer technical-career cards use full-width rows with internal columns. Below 700px these become single-column reading flow with compact illustration/text rows. At widths below 359px the illustrations narrow further. Fine separators and surface tone supply depth; there is no new global palette or type system. The local muted text values (`#a5b0c3`, SVG secondary stroke `#929fb4`) support this guide's legibility and remain surface-specific rather than new global tokens.

## Component seam & behavior

- The route owns section order, group introductions, anchors and the small motion enhancement.
- `TrainingGraphic.astro` owns the three decorative SVG illustrations; `GuideIcon.astro` owns supporting budget/checklist icons. Geometry is authored in source, `aria-hidden`, without official logos, sourced photos or generated raster assets.
- `TrainingOption.astro` separates summaries from full original records and keeps source links outside disclosures. `TrainingNotes.astro` owns credential guidance, comparison questions and research limits.
- `training-guide.css` scopes the visual reading treatment to the guide. `GuideLayout.astro` adds an optional `visual` mode and named `hero` slot; its default prose branch remains the path for other guides.
- Navigation and disclosures are native, keyboard-operable and server-rendered. No essential content waits for JavaScript. Focus outlines are explicit on links and summaries.
- GSAP ScrollTrigger animates only the chooser's decorative amber line, once, from a short line to full width. It does not pin, scrub or intercept scroll. Match-media restricts it to `prefers-reduced-motion: no-preference`; without JS the complete line and reading content remain present. Disclosure toggles, font readiness and restored-page events refresh trigger measurements.

## Advertising constraints

Ads stay disabled. Existing `AdSlot` wiring, visible “Anuncio” labels, placement names and breakpoint behavior remain: `guias-top-1` (320×50 below 1024px), `guias-side-1/2` (160×600 from 1280px), `guias-bottom-desktop-1` (970×90 from 1024px) and `guias-bottom-mobile-1` (320×100 below 1024px). These placements are outside the animated chooser and have no transformed or pinned ancestor. The visual-mode 320px wrapper correction accommodates the full creative width without scaling it.

Development captures show labeled local placeholders. With serving disabled, `AdSlot` omits inventory in a production build; the shared loader and real-unit paths remain gated. The guide does not enable the loader or ad requests. This work makes no claim about AdSense approval or live consent verification.

## Verification evidence & limits

Evidence bundle: `.impeccable/review/training/BRIEF.md`, `qa.json` and the captures in that directory. The JSON contains **30 passing cases**: Chromium/WebKit × widths 320, 390, 524, 768, 1024, 1280 and 1440 × normal/reduced motion (28), plus one no-JS case in each engine (2). Recorded normal/reduced cases report HTTP 200, one H1, seven cards, source fields intact, disclosure keyboard opening/closing, zero horizontal overflow, pins, console errors, missing fragment targets, ad requests or transformed ad ancestors. Both no-JS cases retain seven cards and an operable disclosure.

Builder-reviewed captures cover both engines at 1440, 390, 524 and 320px; Chromium full-page captures at 1440/390; and institution/credential detail captures at 1440/390. The 524px capture uses the user's 524×843 viewport. Full-page shots begin at the top; detail shots intentionally begin inside the article. The QA matrix follows the builder's 320px ad-wrapper correction.

The implementation brief records passing `pnpm build`, `pnpm check:built`, `git diff --check`, and `pnpm visual`; the builder inspected its six homepage captures (two engines × mobile/tablet/desktop). It also records a 390px check of another guide's default layout branch with no overflow, and one changed-target detector run returning `[]`. These command results and the broader visual inspection are builder-reported; this documentation pass read the QA records, checked source seams and inspected the original/1440/524 captures, without rerunning the matrix or certifying every screenshot. The parent confirmed the independent review's **ship** disposition, no material findings and validity of all 14 required captures after the 320px correction. Source links were preserved, not re-verified against institutions in this implementation pass. Automated results and the review verdict do not establish admission, eligibility, real ad serving or live deployment.

## Pre-existing documentation drift — reported, not repaired

- `.impeccable/design.json`, referenced by historical direction material, is absent. No sidecar was created or reconstructed.
- `DESIGN.md` retains its existing numbered legacy format and broad component inventory; it does not yet describe the shared guide layout or these surface-specific components. Its ad-placeholder description also predates the current explicit serving gate, where disabled production ads are omitted and development placeholders remain. Current behavior was checked against `AdSlot.astro` and `src/lib/ads.ts`.
- Global `DESIGN.md` says every animation respects reduced motion; the incumbent global stylesheet still defines skeleton shimmer and job-card hover transforms without a corresponding blanket reduction rule. These are outside this guide's new line animation and were not repaired here.

`PRODUCT.md`, `DESIGN.md`, historical prototypes and global design authority remain unchanged by this surface documentation.
