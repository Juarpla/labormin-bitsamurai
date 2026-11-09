# Labormin

Peru-first mining-jobs hub by Bit SamurAI. Real listings from public employer
boards in Peru and remote roles that can be performed from Peru.

- Docs: [ARCHITECTURE.md](./ARCHITECTURE.md) · [DESIGN.md](./DESIGN.md) · agent rules in [AGENTS.md](./AGENTS.md)

## Quick start

Requires pnpm (≥ 12) — `corepack enable` or see https://pnpm.io/installation.

```bash
pnpm install
node scripts/ingest.mjs   # fetch real jobs → src/data/jobs.json
pnpm dev                  # http://localhost:4321
```

## Environment (all optional)

```bash
PUBLIC_ADSENSE_CLIENT=ca-pub-xxxx   # real AdSense unit rendering (prod)
ADZUNA_APP_ID=...                   # extra source at ingest
ADZUNA_APP_KEY=...
```
