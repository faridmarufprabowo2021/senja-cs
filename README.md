# Senja CS â€” WhatsApp Customer Service (SaaS MVP)

## Stack
- `apps/web` â€” Next.js 15 (light UI + landing)
- `apps/api` â€” Fastify + Prisma + Baileys (`sanka-baileyss`)
- Postgres + Redis (Docker atau instance lokal)

## Setup
```bash
# 1) DB (pakai docker-compose atau Postgres existing)
# DATABASE_URL=postgresql://cs:cs_secret@localhost:5432/customer_service

pnpm install
pnpm --filter @cs/api db:push
pnpm --filter @cs/api db:seed

# 2) Jalankan
pnpm --filter @cs/api dev    # :4000
pnpm --filter @cs/web dev    # :3001
```

## Demo login
- email: `sari@warungsenja.id`
- password: `demo1234`

## API
- `POST /api/v1/auth/login`
- `GET  /api/v1/conversations` (+ X-Tenant-Id)
- `POST /api/v1/wa/sessions` â†’ QR via WS `/api/v1/ws`
- `POST /api/v1/conversations/:id/messages`

## Catatan
Baileys unofficial â€” risiko ban. Jangan spam.
## Graphify (agent map)

Knowledge graph for faster, cheaper agent navigation:

- `graphify-out/graph.html` — interactive graph
- `graphify-out/GRAPH_REPORT.md` — god nodes & questions
- `graphify-out/graph.json` — raw graph

```bash
pnpm graphify:update   # after code changes
pnpm graphify:build    # full rebuild
```

Agents should **query the graph first** (`graphify query "..."`) instead of reading the whole repo.
