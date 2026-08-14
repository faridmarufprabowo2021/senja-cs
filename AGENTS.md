# Agent instructions â€” Senja CS

## Graphify first (token-saving)

This repo has a **Graphify knowledge graph** in `graphify-out/`.

**Before reading many source files**, prefer:

```bash
graphify query "<question about architecture/code>"
# or: graphify path "A" "B"
# or: graphify explain "NodeName"
```

Read `graphify-out/GRAPH_REPORT.md` for god nodes, communities, and suggested questions.

### After non-trivial code changes

Re-sync the graph (incremental, cheap for code):

```bash
pnpm graphify:update
# or full rebuild:
pnpm graphify:build
```

Do **not** re-scan the whole codebase by hand if the graph answers the question.

## Context cache (hemat token)

1. **Codebase Memory MCP first** — project `D-customer-service`; `search_graph` / `get_architecture` / `trace_path`; jangan bulk-read.
2. **Graphify cadangan** — `graphify-out/`; `pnpm graphify:update` setelah fitur.
3. **Sticky files only** — baca file target slice, bukan seluruh app.
4. **CONTINUE_SHORT** di chat baru (`.kilo/CONTINUE_SHORT.md`); detail di `.kilo/CONTINUE.md`.
5. **Reuse patterns** — `requireAuth`/`requireTenant` dari `wa.ts`/`inbox.ts`; `api()` + `useRealtime` di web.
6. **Minimal diff** — 1 fitur/session; typecheck; re-index CBM moderate bila besar.
7. **Jangan** re-seed architecture tiap chat.

## Stack snapshot

- `apps/web` â€” Next.js 15, light UI, Framer Motion / GSAP / Lenis
- `apps/api` â€” Fastify, Prisma, **sanka-baileyss** (WhatsApp)
- `packages/shared` â€” shared TS types
- Postgres via `DATABASE_URL` (see `.env.example`)

## Dev

```bash
pnpm --filter @cs/api dev   # :4000
pnpm --filter @cs/web dev   # :3001
```

Demo: `sari@warungsenja.id` / `demo1234`

## Phase status

- Done: … + A1–A4 + B1 pay + B2 invoice + **B3 lunas auto-nota**
- Next: booking | CRM lite | WA Official | D1 pgvector
- Run: API `:4000` · Web `:3001` · Postgres `:5432` (`random-postgres-1`, DB `customer_service`) · WA = Baileys di dalam API
### Graphify CLI path (Windows)

If `graphify` is not on PATH:

```
%USERPROFILE%\.local\bin\graphify.exe
# or
%APPDATA%\uv\tools\graphifyy\Scripts\graphify.exe
```
