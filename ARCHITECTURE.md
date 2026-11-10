# Labormin — Architecture

Labormin (a Bit SamurAI product) is a Spanish-only mining jobs site for
people in Peru. Ingest accepts jobs in Peru and foreign remote jobs with
sufficient evidence that they can be performed from Peru. It also hosts
hand-curated events and guides, with clearly labeled advertising.

## 1. System overview

```
                  ┌──────────────────────────────────────────────┐
                  │  Public job sources (nicho: PE/CL/CA/US/AU)  │
                  │  • Greenhouse / Lever boards API             │
                  │  • Employer portals (SCC CAPPER, HiringRoom, │
                  │    SuccessFactors CSB, Oracle HCM, PageUp,   │
                  │    SmartRecruiters, Taleo RSS)               │
                  │  • Mining boards (Careermine, Brunel,        │
                  │    Globe 24-7, CA Mining, EmpleosMineros)    │
                  │  • LatAm boards (Computrabajo PE/CL,         │
                  │    Bumeran, Laborum — Navent API)            │
                  │  • Government (Job Bank Canada, fglo=1)      │
                  │  • Arbeitnow / Remotive / RemoteOK /         │
                  │    Adzuna (keyed, solo CA/US/AU — pe/cl no existen como boards)  │
                  │  • LinkedIn top-50 seed via Apify (keyed)    │
                  └────────────────────┬─────────────────────────┘
                                       │  scripts/ingest.mjs (node 22, keys optional)
                                       │  inNiche(): hard-hide fuera de los tiers
                                       ▼
                  ┌──────────────────────────────────────────────┐
                  │  src/data/jobs.json       normalized,        │
                  │  (committed to git)       deduped, 30-day TTL│
                  │  src/data/job-presentation.json (Vista clara) │
                  └────────────────────┬─────────────────────────┘
                                       │  GitHub Actions cron (daily 04:00 UTC)
                                       │  .github/workflows/refresh-jobs.yml
                                       ▼
                  ┌──────────────────────────────────────────────┐
                  │  Astro 7 static build    es único (raíz) +   │
                  │  + Cloudflare adapter    /jobs/[slug] × ~400 │
                  │                          /eventos, /guias,   │
                  │                          /faq, /terms, …     │
                  └────────────────────┬─────────────────────────┘
                                       ▼
                  ┌──────────────────────────────────────────────┐
                  │  Cloudflare Pages        es en la raíz;      │
                  │                          usuario fijo Perú;  │
                  │                          Vista clara estática │
                  └──────────────────────────────────────────────┘
```

Design principle: the site builds Vista clara into each active job page.
The scheduled refresh updates the feed and triggers the static build.

## 2. Data model

Schemas live in `src/schemas.ts` (Zod) and are enforced at build time by
`src/lib/jobs.ts`.

### Job
| Field | Notes |
| --- | --- |
| `id` | source-prefixed: `gh-` `lv-` `an-` `rm-` `az-` `scc-` `hr-` `csb-` `orc-` `pu-` `cm-` `br-` `g7-` `cam-` `jb-` `pn-` `ct-` `nv-` `sr-` `ef-` `ag-` `em-` `li-` |
| `slug` | `company-title-country-id`, used for `/jobs/[slug]` |
| `company`, `companySlug` | normalized display + dedupe key |
| `source` | platform id (see §3) |
| `country` | ISO-2 of a niche country (PE/CL/CA/US/AU), else `GLOBAL` (remotes only) |
| `city`, `locationRaw` | split from source location string |
| `remote` | modalidad; no acredita elegibilidad desde Perú |
| `remoteEligibility` | status `peru-supported/restricted/unknown`, países y evidencia literal |
| `visa` | estado offered/not-offered/authorization-required/relocation-only/unknown/conflicting + evidencia |
| `policyVersion`, `fetchedAt` | versión de clasificación y consulta; detalle completo se reutiliza hasta 7 días |
| `visaReported` | keyword heuristic — surfaced as "reported", never guaranteed |
| `openToInternational?` | set for Job Bank `fglo=1` rows (government-declared international candidacy); may surface as a source-derived badge |
| `category` | `exploration · drill-blast · geology · hse · maintenance · processing · engineering · operations · other` |
| `salary` | `{kind, min, max, currency, period, raw, country?}` o null; kind exact/range/minimum/maximum; moneda, periodo y contexto inequívocos |
| `postedAt` | fecha de referencia para orden/TTL; puede ser observación o actualización; más de 30 días se retira |
| `publishedAt` | fecha de publicación original confirmada o null; nunca se reemplaza por fecha de importación en JobPosting |
| `descriptionStatus`, `excerpt` | full/source-extract/unknown; extracto de búsqueda declarado en Zod |
| `url` | original posting — every UI path must link back here |
| `description` | sanitized HTML (tags stripped → entities decoded → paragraphs). Never translated at ingest; the view layer can render an on-demand AI "clear version" (see §4) |
| `translations?` | `{es,en,pt}` legacy title translations found in older catalog snapshots |

Dedupe key: `companySlug + normalized-title + country`. Stale cutoff: 30 days.
Presentation cache: `src/data/job-presentation.json` (committed; keyed by source version).

### Event (`src/data/events.json`, hand-curated — never scraped)
| Field | Notes |
| --- | --- |
| `mode` | `presencial` (Peru only) or `virtual` (Peru or the power countries) |
| `type` | `feria-laboral · expo · conferencia · webinar` |
| `date` | ISO start date; month-precision entries carry "por confirmar" in `notes` |
| `city`, `country` | display only |
| `officialUrl` | **official source — required**; events without one don't enter |
| `lastVerifiedAt` | re-verify date — required, surfaced in UI |

Feed (`src/data/events.json`) is curated by hand; CI never writes it.

## 3. Job sources (policy)

Every source must be **public and keyless** (JSON API, sitemap, RSS, or a
server-rendered public listing page). All ingestion is **read-only** (GET, or
POST only for keyless public search endpoints), sends a truthful
`LaborminBot/1.0` UA by default (browser UA only where a site filters short
UAs), and respects `robots.txt` and per-site crawl-delays. Config lives in
`src/data/companies.json`.

### Official/employer boards (keyless)

| Source | Platform/parser | Notes |
| --- | --- | --- |
| KoBold (+ DRC, Zambia), Blue Moon | Greenhouse API | |
| Elk Valley Resources | Lever API | |
| Southern Copper | `scc-capper` | ASP.NET page-method POST `{"tipo":19}` (empleo; becas excluded). postedAt = ingest date (kept alive while listed). Peru-only (SPCC Perú). |
| Chinalco Perú, Cerro Verde, Hochschild | `hiringroom` | SSR cards + `get_vacancy` detail; relative ages → approximate dates (30-day TTL applies) |
| Minsur, Codelco, Antamina, BHP, Freeport-McMoRan, Fortescue, Woodside, Teck, Kinross | `sapsf-csb` | SuccessFactors Career Site Builder: sitemap.xml (+lastmod) → microdata JobPosting. Kinross serves a Google-base RSS with descriptions |
| The Redpath Group, Barrick | `oracle-hcm` | Oracle Recruiting Cloud REST (`recruitingCEJobRequisitions`) + jobpostings sitemap for canonical URLs |
| MMG (Las Bambas) | `pageup` | SSR results + JSON-LD detail (crawl-delay 5s) |
| Anglo American | `smartrecruiters` | Public SmartRecruiters JSON API |
| Agnico Eagle | `taleo-rss` | Taleo custom job-list RSS (partial coverage) |

### Mining / LatAm / government boards (keyless)

| Source | Platform/parser | Notes |
| --- | --- | --- |
| Careermine | `jobiqo` | sitemap + JobPosting JSON-LD; bot-check cookie; **Crawl-delay 10s**; `/api/gmapi` is robots-disallowed and never used |
| Brunel | `brunel` | `/en/jobs/mining` facet + JSON-LD detail (mining filter applied) |
| Globe 24-7 | `globe247` | WP Job Manager list + JSON-LD detail |
| CA Mining | `camining` | Simple Job Board sitemap + HTML (mining filter; beware lookalike domain `caming.com` = pharma) |
| Job Bank Canada | `jobbank` | Government SSR; query `sort=M&fglo=1` (official international-candidates filter) → rows marked `openToInternational: true`; Crawl-delay 5s; expired postings skipped |
| Computrabajo (PE/CL) | `computrabajo` | SSR list (`-pN`) + JSON-LD JobPosting detail; keyword pages `mineria` + `minero` per country |
| Bumeran Perú, Laborum Chile | `navent` | **Keyless JSON `POST /api/avisos/searchV2`** with `x-site-id` + sitemap URL resolution. Undocumented API (documented exception); sitemap is the robots-clean fallback channel |
| EmpleosMineros.cl | `empleosmineros` | Keyless JSON API (low volume, low quality) |

### Aggregators & keyed sources

| Source | Platform | Notes |
| --- | --- | --- |
| Arbeitnow, Remotive, RemoteOK | generic | mining-keyword filtered; RemoteOK added 2026-09-10 to reinforce the remote tier |
| Adzuna | `optionalKeyed` | **nicho: CA/US/AU only** (pe/cl no existen como boards — 404 permanente); runs LAST so official sources win dedupe |
| LinkedIn (keyword markets) | `apify-linkedin` | `kaix/linkedin-jobs-scraper` — **guest keyword+location search** via the LinkedIn public guest API (no account/cookies). One actor run per market×keyword, markets in priority order **PE → CL → CA → US** (keywords `minería`+`mining` in PE/CL); cap 100 is the **total per-run budget**, each query gets the remaining budget so PE fills first. `fetchDetails: true` keeps descriptions (title translation + description views need them). Replaces the 50-company seed (removed 2026-09-11 with `linkedin-company-ids.json`). Runs Mon/Wed/Fri |
| Indeed | `apify-indeed` | `factden/indeed-jobs-scraper`, pay-per-result. Markets in priority order **PE → CL → CA → US** (keywords `minería`+`mining` in PE/CL); cap 100 is the **total per-run budget** and each query gets the remaining budget, so PE/CL fill first. Country = search scope. Runs Tue+Thu |
| Seek (AU) | `apify-seek` | `epicscrapers/seek-job-scraper`, AU national keyword search. Search-result fields only (teaser + bullets, verbatim); URL built from the listing's own `roleId`/`id`. cap 50. Runs Sat+Tue |
| Glassdoor | — | **removed 2026-09-11** (owner decision): markets overlapped Indeed/Seek and its CA/US/AU-only scope left the niche thin; budget reassigned to LinkedIn keyword markets |


**Marketplace aggregation via Apify — deliberate ToS decision (2026-09-09).** Seek,
Indeed and (until 2026-09-11) Glassdoor prohibit direct scraping and their public
APIs are closed, so they are ingested **exclusively through guest-mode Apify
pay-per-result actors** (no accounts, no cookies, public listings only) — the
same pattern already documented for LinkedIn. Rationale: Labormin links out to
the original posting; no listing content is altered. Budget guard (2026-09-11
rebalance): all Apify sources fit the Apify **Free plan ($5/mo credits)** with
caps of 100 (LinkedIn keyword markets, Mon/Wed/Fri), 100 (Indeed, Tue/Thu) and
50 (Seek, Sat+Tue) — ≈ $2.10–2.36/mo ceiling. Weekday scheduling via
`LM_SOURCES` in `refresh-jobs.yml` (Sun = `none`: keyless sources only).
Validation gate: if a marketplace returns 0 items consistently for 2 weeks, it
is disabled in `companies.json` and the actor choice revisited. Pause order if
the budget tightens: Seek, then Indeed.

### Performance guards
- `maxPerSource` (default 1500) + per-source `cap` protect `jobs.json` size.
- **Merge-from-previous**: sources that need per-job detail fetches reuse the
  stored description for known ids and only fetch new postings (critical for
  Careermine's 10s delay).
- `INGEST_FAST=<n>` env caps every source at n items (local smoke tests only).

### Deliberately out of scope
- **Careers24** (Apify-only + ToS explicitly prohibits scraping),
  **Antofagasta** (SuccessFactors RKP legacy, session-token JS), **Collahuasi**
  (Imperva WAF) — revisit as a paid Apify wave if ever needed.
- **Glassdoor ZA, Seek outside AU** — no such market/site exists on those
  boards; PE/CL marketplace coverage comes from Indeed + LinkedIn keyword markets.
- **PNet (ZA), Computrabajo MX, Vale (BR)** — removed 2026-09-10: single-country
  sources outside the niche (PE/CL/CA/US/AU).
- **Minería en Línea** — job board discontinued.
- **Never** fabricate listings to fill empty countries. Empty is honest; fake is fatal.

### Manual event updates

Edit `src/data/events.json` after verifying the date with the organizer.
Record the official announcement in `officialUrl` and the date you checked it
in `lastVerifiedAt`. For a multi-day event, add `endDate` so the event stays
listed through its last day. The build validates the file and publishes
upcoming entries at `/eventos/`.

## 4. Personalization & i18n (removed — niche decision 2026-09-10)

- **Spanish only, user fixed to Peru.** `es` lives at the root; the /en and /pt
  route mirrors, the `/api/geo` edge route, the IP-based locale suggestion and
  the `lm-country` / `lm-nationality` / `lm-locale` localStorage keys were all
  removed. `DEFAULT_COUNTRY`/`DEFAULT_NATIONALITY` (`'PE'`, `src/lib/i18n.ts`)
  replace any runtime detection; stale keys in old visitors' browsers are ignored.
- The en/pt dictionaries in `src/i18n/ui.ts` stay dormant (typed, unused) for a
  future LatAm (Spanish-speaking) expansion; `Locale` is currently `'es'`.
- **Vista clara** and Spanish titles use one preparation step in `refresh-jobs.yml`,
  after the raw catalog is pushed. Clear view is built into the job detail page
  with an expandable original and an AI label when applicable. The English title
  translation is reused in listings, with its source title visible in the detail.
- The batch uses imported descriptions from every source. Each block must
  appear once and Spanish blocks are copied from the source. The classifier
  marks text with positive English signals for translation. Other text keeps
  its original language. Source extracts remain labeled. The build uses the
  local view while a result is pending or when the description exceeds the
  request limit.
- The batch validates structure, numbers, shift patterns and detectable visa
  and other restrictions. It can request one correction per listing before
  using the next available provider. Failed results stay pending for a future
  refresh. The cache keys off source data so changed listings get fresh results.
- Preference keys: none — the country context is fixed (Peru) at build time.

## 5. Tiered home

`HomeView.astro` renders server-rendered chapters with `Chapter.astro` (sticky
narrative column + reveal content column) in the niche hierarchy:

1. Hero — Peru and remote counts, CTA to `/jobs`
2. *Minería en Perú* — PE jobs
3. Sector indicators and mining stocks
4. *Eventos mineros* — curated events
5. *Remoto desde Perú* — eligible remote jobs
6. *Kit del postulante* — guides and FAQ
7. CTA → `/jobs`

Everything is static (SEO-safe); no client hydration beyond the JobDrawer index.
Motion: `IntersectionObserver` reveals (`.reveal` → `.is-visible`) with CSS
scroll-driven `animation-timeline: view()` as progressive enhancement; both
respect `prefers-reduced-motion`.

## 6. Ads (AdSense)

- `<AdSlot slotId format layoutKey size media />` — single component for all placements.
  Renders a real `adsbygoogle` unit only when `PUBLIC_ADSENSE_CLIENT` is set in
  production; otherwise a neutral labeled placeholder so layout is testable.
  Fixed-size units (`size`) emit AdSense fixed-size code; `media` gates the
  `adsbygoogle.push` call so a unit never requests an ad outside its breakpoint
  (nothing is hidden after serving).
- Placements: home (2), `/jobs` always-on slots outside the filterable grid (mobile/
  tablet: 320×50 above the filters + 320×100 after the list; desktop ≥lg: 970×90
  after the list; ≥1280px adds 160×600 side rails, sticky-bounded to the section so
  they release before the bottom ad and footer), `/jobs/[slug]`
  in-content and `/eventos`.
- **Policy constraints (non-negotiable):** every unit is labeled ("Ad" /
  "Anuncio" / "Anúncio"); units must not be designed to induce accidental clicks;
  ad density stays low. See DESIGN.md §6.
- AdSense site approval prerequisites shipped: privacy policy (with cookies
  disclosure), about, contact, `public/ads.txt` (replace placeholder publisher id).
- `/jobs/[slug]` pages emit `JobPosting` JSON-LD for Google Jobs eligibility.

## 7. Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `PUBLIC_ADSENSE_CLIENT` | no | `ca-pub-…` publisher id; absent → labeled placeholders |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | no | enables Adzuna country searches at ingest |
| `APIFY_TOKEN` | no | enables the Apify sources (`apify-linkedin` / `apify-indeed` / `apify-seek`) via guest actors |
| `LM_SOURCES` | no | CI-only: comma list of Apify platforms to run; derived from the weekday by `refresh-jobs.yml` (empty/unset = run all, e.g. local dev) |
| LLM_PROVIDER_ORDER | no | Vista clara and English titles. Defaults to AGNES_MODEL,OPENCODE_GO_MODEL,WORKERS_AI_MODEL,MISTRAL_MODEL |
| JOB_PRESENTATION_MAX_CALLS | no | Total calls per run, including failed calls and corrections. Defaults to 30. Use 0 to pause or up to 120 |
| `JOB_GUIDANCE_PROVIDER_ORDER` | no | Background application guidance. Defaults to `AGNES_MODEL`. For Workers AI fallback use `AGNES_MODEL,WORKERS_AI_MODEL` |
| `JOB_GUIDANCE_MAX_CALLS` | no | Provider calls per guidance run, including failures. Defaults to 30, with a maximum of 120. Set to 0 to pause |
| `INGEST_FAST` | no | local only: caps every source at N items for fast smoke tests |

| Provider | Secret or credential | Model variable and default |
| --- | --- | --- |
| Agnes | `AGNES_API_KEY` | `AGNES_MODEL=agnes-3.0-flash` |
| Mistral | `MISTRAL_API_KEY` | `MISTRAL_MODEL=codestral-2508` |
| Workers AI | `CLOUDFLARE_API_TOKEN` with Workers AI Edit and `CLOUDFLARE_ACCOUNT_ID` | `WORKERS_AI_MODEL=@cf/qwen/qwen3.8-27b` |
| OpenCode Go | `OPENCODE_GO_API_KEY` | `OPENCODE_GO_MODEL=mimo-v2.6-flash` |

- **GitHub Actions.** In the repository, open **Settings → Secrets and variables → Actions**. Put the credentials in **Secrets** and the model, order and limit overrides in **Variables**. A missing model override uses the code default. To run guidance on demand, open **Actions → Generate job guidance → Run workflow** and optionally set `max_calls`. A successful feed refresh also triggers this workflow.
- **Vista clara rollout.** Open **Actions → Refresh job data → Run workflow**.
  Check `presentation_only` to use the current catalog and set
  `presentation_max_calls` to limit the run. The static build reads the resulting
  cache. Workers AI credentials, if used, belong in GitHub Actions secrets.
- **Local.** Copy the names from `.env.example` to the ignored `.env` file. `JOB_GUIDANCE_MAX_CALLS=1 node scripts/generate-job-guidance.mjs` runs the batch locally and can update the guidance cache.

## 8. CI / deployment

- GitHub Actions (`refresh-jobs.yml`): daily `node scripts/ingest.mjs` (04:00 UTC),
  commits `src/data/jobs.json` if changed, push triggers the Cloudflare Pages Git
  build (or `CLOUDFLARE_DEPLOY_HOOK` secret as fallback). The paid Apify sources
  are spread across the week via a derived `LM_SOURCES` (see §3) — official/keyless
  sources and Adzuna run every day. `workflow_dispatch` accepts a `sources` input
  to override the weekday schedule for testing. Offline re-filter without
  re-fetching: `node scripts/ingest.mjs --prune` (nicho rules + TTL).
- GitHub Actions (`generate-job-guidance.yml`) selects editorial questions after
  the feed is published. It sends controlled specialty labels and question options,
  reuses valid selections for identical prompts for up to 90 days, and commits
  only `src/data/job-guidance.json`. The site falls back to editorial questions
  when a current selection is unavailable.
- Cloudflare Pages: framework preset Astro, Node 22. pnpm is pinned via
  `packageManager` in package.json (12.3.x); CI installs it automatically via
  `pnpm/action-setup`. On Cloudflare Pages set `PNPM_VERSION=12.3.4` in the
  environment if its default pnpm is older (the lockfile is `lockfileVersion 9.0`,
  readable by any pnpm ≥ 9).

## 9. Phase 2 roadmap

1. Apify wave for the excluded boards (Careers24, Antofagasta RKP, Collahuasi) —
   paid actors, deliberate ToS decision required
2. ~~Indeed pilot in "enrichment" mode~~ — superseded 2026-09-09: Indeed, Seek (AU)
   and (until 2026-09-11) Glassdoor ship as **full-feed** marketplace sources via Apify pay-per-result
   actors (see §3); the deliberate ToS decision is documented there
3. ~~On-demand AI clear view~~ — replaced by the Vista clara batch and static view.
5. `/api/jobs` search endpoint (edge cache) if the client-side index outgrows memory
6. Email alerts by nationality/country

## Revisión de fiabilidad de octubre de 2026

`src/lib/job-policy.mjs` concentra clasificación, normalización salarial,
formato y JobPosting sin red. Todos los adaptadores pasan por `certifyJob`
antes de `inNiche`. Se conservará toda la descripción obtenida; los extractos
se identifican. Se omite marcado cuando faltan fecha de publicación respaldada,
descripción completa o ubicación coherente. No se inventa jornada completa.

Reparación offline: `node scripts/repair-job-feed.mjs` simula y `--write`
aplica; `ingest.mjs --repair`/`--prune` son alias que escriben. Mantiene la fecha
de generación original, guarda informe y un archivo mínimo de fichas retiradas
(`jobs-archive.json`). Esas rutas tienen noindex, sin JobPosting y fuera del
sitemap; noindex no es control de acceso ni medida de privacidad. Las rutas
que nunca existieron conservan el tratamiento 404 del sitio.

`node scripts/ingest.mjs --only="Minera Chinalco Perú"` limita la consulta a
una fuente pública por nombre exacto, desactiva Apify/Adzuna/LLM y conserva los
registros aún recientes de las demás fuentes. Las consultas limitadas no
certifican el resto del catálogo. Si fallan todas las fuentes se conserva el
archivo anterior. El selector `--only` no se usa para fuentes pagadas.

La guía de formación usa `src/data/education.json` con fuente y fecha por
ficha. El directorio `/formacion` amplía ese JSON con dos fuentes públicas:
los PDFs «CETPROS por región» del MINEDU (gob.pe, con archivo de origen por
entrada) y el Diccionario de carreras del MTPE (API de
micarrera.trabajo.gob.pe). El pipeline vive en `scripts/education/`:
`parse-cetpros.py` descarga y parsea los PDFs, `generate-records.py` consulta
la API y regenera el JSON conservando los siete registros originales; el
metadata de descubrimiento sin entrada editorial se deriva en
`src/lib/education.ts`. Investigación y límites en
`docs/FORMACION-ACCESIBLE-PERU.md`. No se
clasifica calidad ni se presume bachiller técnico por duración o gratuidad.
Las nuevas guías comparten `GuideLayout.astro` y las colocaciones `guias-*`.
Los IDs reales de unidades se resuelven desde `PUBLIC_ADSENSE_SLOTS`; nombres
internos no se envían a Google como IDs de unidades.
