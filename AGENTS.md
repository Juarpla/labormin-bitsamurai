# Labormin — AGENTS.md

Labormin is the Peru-first mining-jobs hub by Bit SamurAI: a Spanish-only,
static, ad-funded site. It lists jobs in Peru and remote jobs with evidence
that they can be performed from Peru, alongside events and original guides.
Ads (Google AdSense) are always labeled.

## Development

Package manager: **pnpm** (pinned via `packageManager` in package.json; corepack
or pnpm ≥ 12 required). `pnpm-workspace.yaml` holds the `allowBuilds` approvals
(esbuild, workerd) — pnpm ≥ 11 blocks dependency build scripts by default.

When starting the dev server, use background mode:

```
pnpm astro dev --background
```

Manage the background server with `pnpm astro dev stop`, `pnpm astro dev status`, and
`pnpm astro dev logs`.

```bash
pnpm install      # install (pnpm-lock.yaml is the source of truth)
pnpm dev          # foreground dev server
pnpm build        # production build (static + Cloudflare adapter)
pnpm preview      # preview the production build
pnpm visual       # capture UI screenshots across chromium/webkit at
                  # mobile/tablet/desktop viewports into screenshots/
node scripts/ingest.mjs         # refresh src/data/jobs.json from live sources
node scripts/ingest.mjs --prune # offline: re-apply niche rules + TTL to the stored feed
```

### Verification

After any UI or layout change, run `pnpm visual` and inspect the captures in
`screenshots/` to verify the UI and its responsiveness across viewports and
engines before considering the change done. The script reuses a dev server
already running on localhost:4321-4326; otherwise it starts (and stops) its own.
`VISUAL_BROWSERS=firefox` opts into additional engines (install with
`npx playwright install firefox` first).

## Hard rules

1. **Real jobs only.** Every listing comes from a public, legal source
   (`scripts/ingest.mjs`). Never invent, edit, or "improve" job content, and never
   fabricate listings when a source returns nothing. Salary figures are shown
   **only** when the source declares them.
2. **Ads are always labeled.** The `<AdSlot />` component always renders the
   "Anuncio" label. Never disguise ads as job cards beyond the native styling;
   deceptive ad framing is an AdSense policy violation and risks an account ban.
3. **Visa claims are heuristic.** Visa-sponsorship flags come from listing text
   keywords; UI copy must keep the "reported" framing ("Verify with the employer").
4. **Official-source data.** `src/data/events.json` entries must cite a verifiable
   `officialUrl` and carry a real `lastVerifiedAt` date. Re-verify before editing;
   unsupported events do not enter the seed. Presencial events are Peru only;
   virtual events are Peru or the four power countries.
5. **Vista clara is presentation data.** Show it by default without an AI notice
   or an original-text toggle in the job detail. Preserve Spanish titles and
   source facts, and show the original title with translated titles.
   Keep AI results separate from `src/data/jobs.json` and from niche decisions.
   See [ARCHITECTURE.md](./ARCHITECTURE.md) for the pipeline and provider settings.
6. **Niche hierarchy is enforced at ingest, not display.** `inNiche()` in
   `src/lib/job-policy.mjs` accepts jobs in Peru and foreign remote jobs only
   with evidence that they can be done from Peru. The UI sorts by tier.
7. **Spanish only, Peru fixed.** `es` lives at the root; there are no /en or /pt
   routes and no IP-based detection. The visitor is assumed Peruvian
   (`DEFAULT_COUNTRY`/`DEFAULT_NATIONALITY` in `src/lib/i18n.ts`).

## Architecture & design docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design, data flow, schemas,
  sources, i18n, ads wiring, phase-2 roadmap.
- [`DESIGN.md`](./DESIGN.md) — style guide (Apple HIG-informed), components,
  motion and ad-placement rules.

## Key paths

```
scripts/ingest.mjs            job ingestion (write jobs.json; +title translations; --prune niche filter)
scripts/education/            formación: PDFs CETPRO del MINEDU + Diccionario MTPE → education.json (README interno)
scripts/ingest-stocks.mjs     stock quotes ingestion (write stocks.json; Yahoo Finance + FX → USD; monthly CI)
src/data/companies.json       curated public boards (extend here to add companies — niche: PE/CL/CA/US/AU)
src/data/events.json          hand-curated mining events seed (officialUrl + lastVerifiedAt required)
src/data/jobs.json            generated feed (commit; refreshed daily by CI; niche-filtered)
src/data/job-presentation.json  prepared titles and Vista clara cache (commit)
src/schemas.ts                Zod schemas for Job / Event / feeds
src/lib/jobs.ts               build-time data helpers (tierOf, tier ranking)
src/lib/events.ts             build-time event helpers (upcoming)
src/lib/llm.js               multi-provider LLM chain (titles + clear view)
src/lib/i18n.ts               localePath, niche countries, DEFAULT_COUNTRY/DEFAULT_NATIONALITY
src/i18n/ui.ts                UI dictionary (es active; en/pt dormant)
src/components/pages/*.astro  page views (HomeView, JobsView, JobDetailView, EventsView, BolsaView, PracticasView)
src/pages/                    routes: /, /jobs, /bolsa, /practicas, /eventos, /guias(+2 guías), /faq,
                              /about, /contact, /privacy, /terms, /ops
docs/ADSENSE-CHECKLIST.md     AdSense admission checklist (owner + code states)
PRODUCT.md                    durable product truth (impeccable init)
```

## Conventions

- Stack: pnpm, Astro 7 (static output + Cloudflare adapter), Tailwind v4, vanilla
  islands (`<script>`), Zod. No React/framework islands — keep it that way.
- i18n: **`es` is the ONLY language** (lives at the root, no URL prefix). The
  en/pt dictionaries in `src/i18n/ui.ts` are dormant (kept for a future LatAm
  expansion; `Locale` is currently typed to `es`). Job titles are auto-translated
  to `es` during preparation (badged). Rule 5 applies to imported descriptions.
- Country context is FIXED to Peru (`DEFAULT_COUNTRY = 'PE'`): no IP detection,
  no selectors, no `lm-country`/`lm-nationality`/`lm-locale` localStorage keys —
  stale values in old visitors' browsers are simply ignored.
- Job feed order: tiers (`tierOf`) then `postedAt desc`. Foreign remote listings require evidence they can be performed from Peru.
- Ads: `AdSlot` slot ids are per page/section (`home-*`; jobs: `jobs-top-1`,
  `jobs-side-1/2`, `jobs-bottom-desktop-1`, `jobs-bottom-mobile-1`;
  `job-detail-1`, `job-detail-2` (before "Empleos similares"); events: `events-top-1`,
  `events-side-1/2`, `events-bottom-desktop-1`, `events-bottom-mobile-1`;
  formación: `formacion-top-1`, `formacion-side-1/2`, `formacion-bottom-desktop-1`,
  `formacion-bottom-mobile-1`;
  guías (shared by index + detail pages): `guias-top-1`, `guias-side-1/2`,
  `guias-bottom-desktop-1`, `guias-bottom-mobile-1`; bolsa: `bolsa-top-1`,
  `bolsa-side-1/2`, `bolsa-bottom-desktop-1`, `bolsa-bottom-mobile-1`;
  practicas: `practicas-top-1`, `practicas-side-1/2`, `practicas-bottom-desktop-1`,
  `practicas-bottom-mobile-1`;
  faq: `faq-bottom-desktop-1`, `faq-bottom-mobile-1`; about: `about-bottom-desktop-1`,
  `about-bottom-mobile-1`). /jobs, /bolsa, /eventos, /guias, /formacion and /practicas share the
  same always-on distribution: fixed 320×50 top (mobile/tablet), 970×90 bottom
  (desktop ≥lg) or 320×100 (mobile/tablet), sticky 160×600 side rails (desktop
  ≥1280px) around a centered content column; /faq and /about carry only the horizontal
  bottom pair, no rails. Slots sit outside the filterable grid and are never
  hidden after serving. Placeholders render in dev/absent client id; real ads
  need `PUBLIC_ADSENSE_CLIENT` + prod + publisher ID in `public/ads.txt` (see
  `docs/ADSENSE-CHECKLIST.md`).
- Deployment: Cloudflare Pages. Feed freshness via GitHub Actions cron
  (`.github/workflows/refresh-jobs.yml`) committing `src/data/jobs.json`.
