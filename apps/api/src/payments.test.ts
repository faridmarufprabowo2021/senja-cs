/**
 * Payments — Midtrans webhook tests (B3 auto-nota path)
 * Run: pnpm --filter @cs/api test:payments
 * Requires Postgres (DATABASE_URL). Creates ephemeral tenant, cleans up.
 *
 * CATATAN: env default MIDTRANS_IS_PRODUCTION=false (sandbox) — webhook
 * toleran terhadap signature invalid. Rejection path (401) hanya aktif
 * saat production dan tidak diuji di sini karena env di-parse saat import.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { env } from "./lib/env.js";

const stamp = Date.now().toString(36);
const ids = { tenant: "", contact: "", order: "", order2: "" };

const app = await buildApp({ logger: false });
await app.ready();

after(async () => {
  try {
    if (ids.tenant) {
      await prisma.tenant.delete({ where: { id: ids.tenant } }).catch(() => undefined);
    }
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});

const tenant = await prisma.tenant.create({
  data: {
    name: `Pay Test ${stamp}`,
    slug: `pay-${stamp}`,
    botSettings: { create: {} },
  },
});
ids.tenant = tenant.id;

const contact = await prisma.contact.create({
  data: {
    tenantId: tenant.id,
    waJid: `62877${stamp.slice(-6)}@s.whatsapp.net`,
    phone: `+62877${stamp.slice(-6)}`,
    name: "Pay Contact",
  },
});
ids.contact = contact.id;

const order = await prisma.order.create({
  data: { tenantId: tenant.id, contactId: contact.id, status: "confirmed", total: 25000 },
});
ids.order = order.id;

const order2 = await prisma.order.create({
  data: { tenantId: tenant.id, contactId: contact.id, status: "confirmed", total: 10000 },
});
ids.order2 = order2.id;

function sign(orderId: string, statusCode: string, grossAmount: string) {
  return crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${env.MIDTRANS_SERVER_KEY}`)
    .digest("hex");
}

function webhook(payload: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/v1/payments/midtrans-webhook",
    payload,
  });
}

test("missing order_id → 400", async () => {
  const res = await webhook({ transaction_status: "settlement" });
  assert.equal(res.statusCode, 400);
});

test("valid signature + settlement + unknown order → 404", async () => {
  const ghostId = `ghost-${stamp}`;
  const res = await webhook({
    order_id: ghostId,
    status_code: "200",
    gross_amount: "25000.00",
    transaction_status: "settlement",
    signature_key: sign(ghostId, "200", "25000.00"),
  });
  assert.equal(res.statusCode, 404);
});

test("valid settlement → order marked paid (receipt fails gracefully tanpa WA)", async () => {
  const res = await webhook({
    order_id: ids.order,
    status_code: "200",
    gross_amount: "25000.00",
    transaction_status: "settlement",
    signature_key: sign(ids.order, "200", "25000.00"),
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json() as { ok: boolean; status?: string };
  assert.equal(body.ok, true);
  assert.equal(body.status, "paid");

  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: ids.order } });
  assert.equal(fresh.status, "paid");
});

test("duplicate settlement → idempotent 'Order already paid'", async () => {
  const res = await webhook({
    order_id: ids.order,
    status_code: "200",
    gross_amount: "25000.00",
    transaction_status: "settlement",
    signature_key: sign(ids.order, "200", "25000.00"),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { ok: boolean; message?: string };
  assert.equal(body.message, "Order already paid");
});

test("capture + fraud deny → NOT paid", async () => {
  const res = await webhook({
    order_id: ids.order2,
    status_code: "200",
    gross_amount: "10000.00",
    transaction_status: "capture",
    fraud_status: "deny",
    signature_key: sign(ids.order2, "200", "10000.00"),
  });
  assert.equal(res.statusCode, 200);
  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: ids.order2 } });
  assert.equal(fresh.status, "confirmed");
});

test("sandbox mode: invalid signature masih diproses (testing tolerance)", async () => {
  const res = await webhook({
    order_id: ids.order2,
    status_code: "200",
    gross_amount: "10000.00",
    transaction_status: "settlement",
    signature_key: "bogus-signature",
  });
  assert.equal(res.statusCode, 200, res.body);
  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: ids.order2 } });
  assert.equal(fresh.status, "paid");
});
