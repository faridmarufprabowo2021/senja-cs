# Senja CS — Continuation Prompt (token-efficient)

Copy-paste this as the **first message** when starting a new chat/session.

---

## Who you are
You are continuing development of **Senja CS**: multi-tenant WhatsApp Customer Service SaaS for UMKM (Indonesia). Prefer **Graphify + AGENTS.md** over reading the whole repo. Shortest working code (ponytail). Do not invent files—query graph first.

## Product decisions (locked)
- Model: **SaaS multi-UMKM** (tenant isolation via `X-Tenant-Id` + JWT)
- WA channel: **Baileys** package `sanka-baileyss` (unofficial; ban risk)
- MVP: multi-agent inbox + Bot AI + RAG + human handover
- UI: **light mode** (paper white), Framer Motion / GSAP / Lenis on landing
- LLM: OpenAI-compatible **OpenAgentic** → `LLM_BASE_URL=https://openagentic.id/api/v1`, model `claude-sonnet-4.5` (key in `.env` only, never commit)

## Stack
| Path | Tech |
|------|------|
| `apps/web` | Next.js 15 App Router, Tailwind 4, Framer Motion, port **3001** |
| `apps/api` | Fastify 5, Prisma, JWT, WebSocket, `sanka-baileyss`, port **4000** |
| `packages/shared` | Shared TS types |
| DB | Postgres `DATABASE_URL` (often Docker container on :5432) |
| Graph | `graphify-out/` — query before bulk file reads |

## Run
```bash
pnpm --filter @cs/api dev   # :4000
pnpm --filter @cs/web dev   # :3001
```
Demo: `sari@warungsenja.id` / `demo1234`  
After non-trivial changes: `pnpm graphify:update` (AST) or full skill rebuild.

## Architecture (mental map)
```
Web (Next) --REST/WS--> API (Fastify)
                         ├ auth / tenants
                         ├ wa (Baileys WaManager → QR, inbound, sendText)
                         ├ inbox (conversations, messages, assign)
                         ├ knowledge (docs, chunk, embed, query)
                         └ bot (settings, scheduleBotReply → RAG → LLM → WA)
                         Postgres + local hash embeddings (or remote embed if set)
```

## Key files (do not re-discover blindly)
**API**
- `apps/api/src/index.ts` — route registration
- `apps/api/src/wa/manager.ts` — Baileys session, inbound → bot schedule
- `apps/api/src/bot/reply.ts` — handover keywords, retrieve, LLM, escalate
- `apps/api/src/bot/ingest.ts` / `retrieve.ts` — chunk + cosine RAG
- `apps/api/src/lib/llm.ts` / `embed.ts` / `env.ts` — OpenAgentic + fallbacks
- `apps/api/src/routes/{auth,tenants,wa,inbox,knowledge,bot,ws}.ts`
- `apps/api/prisma/schema.prisma`

**Web**
- Landing: `apps/web/src/components/landing/landing-page.tsx`
- Inbox: `apps/web/src/components/inbox.tsx` (live API + WS)
- Auth client: `apps/web/src/lib/api.ts`, `use-realtime.ts`
- Pages: `(app)/dashboard|inbox|channels|knowledge|bot|team|settings`

**Agent**
- `AGENTS.md` — always prefer graphify query
- `graphify-out/GRAPH_REPORT.md`, `graph.json`, `graph.html`

## Done (do not rebuild)
- Monorepo, light landing + app shell animations
- Auth JWT, multi-tenant members
- WA connect QR (Baileys), send/receive text, WS events
- Inbox API + frontend wire (assign, resolve, mode)
- Knowledge upload/ingest, bot settings, RAG retrieve
- Bot auto-reply on inbound when `mode=bot` (debounce)
- Claude via OpenAgentic for chat; local embed if no embed model
- Graphify installed + update scripts

## Phase next (pick one slice and finish end-to-end)
### C — Product polish
1. Real onboarding: register tenant → WA connect → seed FAQ
2. Media messages (image/doc) inbound + outbound
3. Team invite by email + roles
4. Real metrics (first response time, bot-resolved %)
5. Inbox citation chips from bot `metadata`

### D — Hardening
6. Tenant isolation / IDOR tests
7. Rate limit bot + WA reconnect reliability
8. Structured logging (requestId, tenantId, sessionId)
9. Graphify update after each feature

### RAG upgrade (optional)
10. pgvector instead of in-memory cosine over JSON embeddings
11. Hybrid keyword + vector
12. Re-embed all chunks when switching embed model

## Coding rules (token + quality)
1. **Graphify first**: `graphify query "..." --graph graphify-out/graph.json` before reading many files
2. **Minimal diff**: fewest files; reuse `requireAuth`/`requireTenant` hooks pattern from `wa.ts`/`inbox.ts`
3. **No secrets in git**: only `.env` (gitignored)
4. **Baileys**: keep channel abstraction; don’t spam; handle disconnect
5. **LLM**: if chat fails, keep extractive fallback in `llm.ts`; parse gateway quirks (trailing `data: [DONE]`)
6. After slice: typecheck `pnpm --filter @cs/api typecheck` + `pnpm --filter @cs/web typecheck`, smoke health + login, `pnpm graphify:update`
7. Do not start with “Great/Sure”; deliver code; no unrequested docs

## First action this session
State which task from Phase C/D you will implement, then:
1. Graphify query related symbols
2. Implement vertical slice
3. Verify + graphify update

Default if user said only “lanjut”: **C1 real onboarding** or **C5 citation chips** (smallest UX win) unless they specify.

## Demo paths
- Landing: http://localhost:3001/
- App: login → dashboard → inbox / channels / knowledge / bot
- API health: http://localhost:4000/health
