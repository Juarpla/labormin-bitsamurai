---
version: 1
slug: "src-pages-guias-verificar-oferta-remota-visa-salario-astro"
primary_target: "src/pages/guias/verificar-oferta-remota-visa-salario.astro"
related_targets: ["src/components/guides/OfferGraphic.astro", "src/styles/offer-guide.css", "src/layouts/GuideLayout.astro"]
---

# Surface brief — verificar una oferta remota, visa y salario

## Scope & mode

- Route: `/guias/verificar-oferta-remota-visa-salario/`.
- Mode: **Read**. An ordinary existing-world extension of the selected education-guide Recorrido treatment, implemented in the real guide.
- Status: implemented locally; independent full-surface finish review returned **ship**, accepted all 14 required captures and found no material issues. This document does not establish deployment.
- Write boundary: this surface brief only. `PRODUCT.md`, `DESIGN.md`, the absent `.impeccable/design.json`, shared `GuideLayout.astro` and `AdSlot.astro` are preserved.

## Direction contract

**THESIS:** three concrete checks—residence, declared visa support and applicable salary—turn a continuous article into a readable verification guide.

**OWN-WORLD:** retain Labormin graphite, amber, Fraunces headings, Inter reading text, shared chrome and guide layout. Authored line SVGs illustrate location, permission and payroll.

**STORY:** scan the three checks, jump to the relevant section, distinguish original wording, then ask the employer a precise question.

**FIRST VIEWPORT:** two-column desktop title/deck; three illustrated anchor choices beneath. Mobile uses stacked illustration/text rows. No content is hidden by motion.

**FORM:** code-led extension of the user's chosen Recorrido option 2; no new seed or approved comp. Signature interaction is native anchor navigation with a single once-only decorative amber-line reveal; no pinning or scroll interception. Reduced motion has no reveal.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

The FINISH block is retained from the implementation packet. Under the ordinary-extension boundary, existing `DESIGN.md` remains the visual authority and is compared rather than rewritten. This implementation ships no new raster assets; its three illustrations are authored SVG source.

## Audience, purpose & content contract

A Peruvian reader should be able to identify whether a remote role permits residence in Peru, distinguish reported visa support from relocation or a prior-permit requirement, and confirm the salary applicable to their location. Three native anchors lead to `#remoto`, `#visa` and `#salario`. The close supplies document-safety checks and a specific employer question the reader can adapt.

The former continuous article is distilled into four location cases, four visa definitions, four salary checks, two native disclosures and a final question. English phrases remain explicit original terms with `lang="en"`; interpretation and questions sit beside them in Spanish. The visible reported-visa framing, conditional language and employer-verification requirement remain. This is editorial guidance, without invented jobs, salary figures, eligibility guarantees or new factual research.

All four original external destinations and the original **26 October 2026** consultation date are retained:

- KoBold example: `https://job-boards.greenhouse.io/koboldmetals/jobs/4677639005`.
- Job Bank: `https://on.jobbank.gc.ca/support/question?qaid=31&tid=10`.
- USCIS: `https://www.uscis.gov/working-in-the-united-states`.
- FTC: `https://consumer.ftc.gov/articles/job-scams`.

The example remains a dated observation about that vacancy, not a claim about the employer's other hiring. Internal visa-pathway and contact destinations remain. These links and factual references were preserved, **not re-verified**, in this implementation or documentation pass.

## Incumbent comparison & visual result

Compared authorities: `PRODUCT.md`, `DESIGN.md`, current global styles, the previous remote-guide source at HEAD, the education-guide surface brief, shared `GuideLayout.astro` and the completed route/components/styles. The documentation pass also opened the remote guide's Chromium 1440px and actual-user 524×843 captures and the education guide's Chromium 1440px capture.

The education guide's two-column hero, illustrated three-choice surface, crisp line geometry and restrained amber rule now form a recognizable sibling on the remote guide. Graphite backgrounds, Fraunces display/section headings, Inter body/UI text, shared navigation, breadcrumb, rounded surfaces and fine separators retain Labormin's incumbent identity. The remote guide changes the subject-specific imagery to home/location, permission/document and payroll, and gives the continuing article a definition table, open reading rows and checklist rather than copying institution cards.

Desktop uses a two-column hero, three-column chooser, paired location/pay checks and two-column definition rows. At 700px and below these become a single reading flow; the chooser becomes illustration/text rows with 96px graphics. Below 359px the graphics narrow to 64px. The surface-specific muted text `#a5b0c3`, compact metadata and local reading sizes are implementation details, not additions to global design tokens. Tonal surfaces and separators provide depth without a new elevation system.

## Component seam, behavior & access

- The route owns chapter order, editorial text/data arrays, anchors, disclosures and motion enhancement. `OfferGraphic.astro` owns three decorative SVG variants (`aria-hidden`, nonfocusable); `offer-guide.css` scopes the guide treatment. No raster generation, stock imagery or official logos are introduced.
- The guide reuses the incumbent `visual` mode and `hero` slot of `GuideLayout.astro`; neither shared layout nor ad component changed for this extension.
- Essential content renders on the server. Native anchors and disclosures work without JavaScript; links and summaries have explicit visible focus outlines. Both disclosures keep their text in the document.
- GSAP ScrollTrigger reveals only the decorative amber rule, once, from a short line to full width over 0.7 seconds with `expo.out`. It neither pins nor scrubs nor intercepts scrolling. Match-media restricts the reveal to `prefers-reduced-motion: no-preference`; the static full rule remains without JS. Disclosure toggles, font readiness and restored-page events refresh trigger measurements.

## Advertising constraints

Existing placement names and breakpoint behavior remain in shared layout: `guias-top-1` (320×50 below 1024px), `guias-side-1/2` (160×600 from 1280px), `guias-bottom-desktop-1` (970×90 from 1024px), and `guias-bottom-mobile-1` (320×100 below 1024px). Slots remain outside the animated chooser, with no pinned or transformed ancestor. The incumbent visual-mode correction accommodates the full 320px creative at narrow widths without scaling.

Development captures show labeled **Anuncio** placeholders. Production serving remains disabled: the existing gate omits disabled production inventory, and this extension does not enable the loader or requests. Retained slot wiring is not evidence of live serving, AdSense admission or consent validation.

## Verification evidence & limits

Evidence: `.impeccable/review/remote-guide/BRIEF.md`, `qa.json`, `detector.json`, `REVIEW.md` and its captures. The documentation pass read these records and independently summarized the JSON: **30 cases**, comprising Chromium/WebKit × seven widths (320, 390, 524, 768, 1024, 1280, 1440) × normal/reduced motion (28), plus one no-JS case per engine (2). Normal/reduced records report HTTP 200, one H1, three graphics, four visa terms, four salary checks, keyboard disclosure opening/closing, zero horizontal overflow, missing fragment targets, pins, transformed ad ancestors, console errors or ad requests. Both no-JS cases retain three graphics and an openable disclosure. The changed-target detector returned `[]`.

The independent reviewer opened and accepted all 14 named captures: both engines at 320/390/524/1440px, Chromium full-page at 390/1440px, and visa/salary detail captures at 390/1440px. Full-page images start at the document top; section captures intentionally begin within their named section. The parent also reports opening all 14 images and all six `pnpm visual` shared-homepage captures. Initial captures invalidated by a dev-server HMR restart were discarded and rerun; no corrections were based on them.

The implementation packet and parent report passing `pnpm build`, `pnpm check:built`, 23 unit tests and `pnpm visual`. Build validation includes two feed repairs described in the packet (Unicode-safe excerpt derivation and active republished-job precedence over archive entries in the sitemap); original descriptions remain unchanged. Those repairs are outside this surface's design documentation. This pass did not rerun tests, use a browser, inspect every capture or repeat runtime checks; its visual inspection was the three captures named above. Review and automation do not establish current source eligibility, production deployment, consent behavior or live ad serving.

## Pre-existing drift — reported, not repaired

- `.impeccable/design.json` is absent. No sidecar was reconstructed.
- `DESIGN.md` retains its numbered legacy format and does not yet inventory the shared guide visual mode or local guide components. Its placeholder description predates the explicit serving gate: disabled production inventory is omitted, while development placeholders remain.
- `DESIGN.md` says every animation is disabled under reduced motion. The incumbent global stylesheet still defines skeleton shimmer and job-card hover transforms outside its reduction rules. This guide's new rule animation respects reduced motion; no global repair is included.

No global product or visual-system decision was changed or canonized by this ordinary extension.
