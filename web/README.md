# Public trade-in comparison site (`web/`)

Separate app from the admin (`frontend/` + `backend/`). It shares only the database, and only through the public read model (Phase 2). No shared code, secrets or sessions.

Spec: `docs/cursor-prompt-tradein-site.md` · Decisions: `docs/DECISIONS.md` · Discovery: `docs/DISCOVERY.md`

## Requirements

Node 22 (see `.nvmrc`; Next.js 16 needs ≥ 20.9). The admin frontend can stay on its own Node version.

```bash
cd web
nvm use            # switches to Node 22 for this shell only
npm ci
cp .env.example .env.local
npm run dev        # http://localhost:3000 (Hebrew), /en (English)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run typecheck` | Route types + `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run test:db` | Apply migrations + pgTAP in an in-memory Postgres (never touches production) |

## Layout

- `src/app/[locale]/` – pages (Hebrew at `/`, English at `/en`)
- `src/proxy.ts` – locale routing + per-request CSP nonce
- `src/lib/security/` – CSP builder and static security headers
- `src/env/` – Zod-validated environment (`server.ts` is server-only)
- `src/i18n/`, `messages/` – next-intl config and translations
- `src/components/layout/` – header, mobile drawer, footer, language switch
- `src/server/data/` – only place that talks to the public read model
- `../supabase/migrations/` – additive SQL (`002`–`004`); apply from `docs/SUPABASE_SETUP_CHECKLIST.md`

## Deploying (Vercel)

Create a **new** Vercel project with Root Directory `web`. Set `NEXT_PUBLIC_SITE_URL` (https), `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do not copy any variables from the admin project. Apply the database steps in `docs/SUPABASE_SETUP_CHECKLIST.md` first.
