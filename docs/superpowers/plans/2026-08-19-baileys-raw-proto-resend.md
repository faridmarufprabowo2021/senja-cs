# Baileys Raw Proto Store & E2EE Auto-Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store raw Baileys `proto.IMessage` structures for outbound WhatsApp messages in memory and PostgreSQL DB, returning them exact and un-altered in `getMessage` resend callbacks to eliminate "Menunggu pesan ini..." E2EE decipherment failures on customer phones.

**Architecture:** Update Prisma schema with `rawProto` text column on `Message`, maintain an LRU cache in `BaileysDriver`, update `sendText`/`sendMedia` to capture raw proto, update `getMessage` to return full `proto.IMessage`, update message persistence calls in `bot/reply.ts` and `routes/inbox.ts`, and trigger `uploadPreKeys(50)` on socket connection.

**Tech Stack:** TypeScript, Node.js, Fastify, Baileys (`sanka-baileyss`), Prisma, PostgreSQL.

## Global Constraints

- Monorepo structure: `apps/api`, `apps/web`, `packages/shared`.
- Database operations must use `prisma` instance from `src/lib/prisma.ts`.
- Retain existing API routes and types.
- Ensure `pnpm typecheck` passes with 0 errors.

---

### Task 1: Prisma Schema Migration for `rawProto` Column

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Consumes: Prisma schema `Message` model
- Produces: `rawProto` optional `@db.Text` string on `Message`

- [ ] **Step 1: Add `rawProto` to `Message` model in `schema.prisma`**

Edit `apps/api/prisma/schema.prisma` to add:
```prisma
model Message {
  id             String    @id @default(cuid())
  // ...
  waMessageId    String?   @index
  rawProto       String?   @db.Text
  // ...
}
```

- [ ] **Step 2: Apply database schema update**

Run: `pnpm --filter @cs/api db:push`  
Expected: `The database is now in sync with the Prisma schema.`

- [ ] **Step 3: Regenerate Prisma Client**

Run: `pnpm --filter @cs/api db:generate`  
Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit schema changes**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): add rawProto column to Message model"
```

---

### Task 2: Update `BaileysDriver` with Memory LRU Cache & Exact `getMessage` Proto Resend

**Files:**
- Modify: `apps/api/src/wa/drivers/baileys.driver.ts`

**Interfaces:**
- Consumes: Baileys `makeWASocket`, `proto.IMessage` from `sanka-baileyss`
- Produces: `rawMessageCache`, `sendText`, `sendMedia` returning `rawProto`, `uploadPreKeys(50)` on connect

- [ ] **Step 1: Add `rawMessageCache` & PreKey upload logic to `BaileysDriver`**

In `apps/api/src/wa/drivers/baileys.driver.ts`:
- Add `private rawMessageCache = new Map<string, any>();` to `BaileysDriver`.
- Update `connection.update` event handler: when `connection === "open"`, call `this.socket?.uploadPreKeys(50)?.catch(() => {})`.

- [ ] **Step 2: Update `getMessage` callback in `BaileysDriver`**

In `getMessage: async (key: any)`:
- Check `this.rawMessageCache.get(key.id)`. If present, return it.
- If not in memory, query `prisma.message.findFirst({ where: { waMessageId: key.id } })`.
- If `dbMsg?.rawProto` exists, `return JSON.parse(dbMsg.rawProto)`.
- If missing, return `undefined`.

- [ ] **Step 3: Update `sendText` and `sendMedia` to store raw proto**

In `sendText`:
```typescript
const sent = await this.socket.sendMessage(jid, { text });
if (sent?.key?.id && sent?.message) {
  this.rawMessageCache.set(sent.key.id, sent.message);
  if (this.rawMessageCache.size > 1000) {
    const firstKey = this.rawMessageCache.keys().next().value;
    if (firstKey) this.rawMessageCache.delete(firstKey);
  }
}
return {
  ...sent,
  rawProto: sent?.message ? JSON.stringify(sent.message) : undefined,
};
```
In `sendMedia`:
Apply the same caching & `rawProto` property return.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`  
Expected: `Tasks: 3 successful, 3 total`

- [ ] **Step 5: Commit changes**

```bash
git add apps/api/src/wa/drivers/baileys.driver.ts
git commit -m "feat(wa): store and resend raw Baileys proto in getMessage callback"
```

---

### Task 3: Update Bot Reply and Inbox Message Creation Pipelines

**Files:**
- Modify: `apps/api/src/bot/reply.ts`
- Modify: `apps/api/src/routes/inbox.ts`

**Interfaces:**
- Consumes: `sent.rawProto` from `waManager.sendText` / `waManager.sendMedia`
- Produces: Persistent `rawProto` field in Prisma `Message.create`

- [ ] **Step 1: Update `scheduleBotReply` in `apps/api/src/bot/reply.ts`**

When calling `waManager.sendText(...)`, pass `rawProto: (sent as any)?.rawProto` into `prisma.message.create({ data: { ... } })`.

- [ ] **Step 2: Update manual agent send routes in `apps/api/src/routes/inbox.ts`**

When calling `waManager.sendText(...)` or `waManager.sendMedia(...)`, pass `rawProto: (sent as any)?.rawProto` into `prisma.message.create({ data: { ... } })`.

- [ ] **Step 3: Run monorepo typecheck**

Run: `pnpm typecheck`  
Expected: `3 successful, 3 total`

- [ ] **Step 4: Commit changes**

```bash
git add apps/api/src/bot/reply.ts apps/api/src/routes/inbox.ts
git commit -m "feat(bot): persist rawProto to database on bot and agent outbound messages"
```

---

### Task 4: End-to-End Verification & Restart Services

**Files:**
- Test & Verify: Live API server, DB records, WhatsApp bot response

- [ ] **Step 1: Restart API server (`pnpm --filter @cs/api dev`)**
- [ ] **Step 2: Verify `rawProto` is saved in DB for outbound bot messages**
- [ ] **Step 3: Verify zero "Menunggu pesan ini..." errors on recipient WhatsApp client**
