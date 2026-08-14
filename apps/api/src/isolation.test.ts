/**
 * A1 — Tenant isolation / IDOR tests
 * Run: pnpm --filter @cs/api test:isolation
 * Requires Postgres (DATABASE_URL). Creates ephemeral tenants, cleans up.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const stamp = Date.now().toString(36);
const emailA = `iso-a-${stamp}@test.local`;
const emailB = `iso-b-${stamp}@test.local`;
const password = "test-iso-pass-99";

const ids = {
  userA: "",
  userB: "",
  tenantA: "",
  tenantB: "",
  productB: "",
  orderB: "",
  contactB: "",
  convB: "",
  docB: "",
  waB: "",
};

const app = await buildApp({ logger: false });
await app.ready();

after(async () => {
  try {
    if (ids.tenantA) {
      await prisma.tenant.delete({ where: { id: ids.tenantA } }).catch(() => undefined);
    }
    if (ids.tenantB) {
      await prisma.tenant.delete({ where: { id: ids.tenantB } }).catch(() => undefined);
    }
    if (ids.userA) {
      await prisma.user.delete({ where: { id: ids.userA } }).catch(() => undefined);
    }
    if (ids.userB) {
      await prisma.user.delete({ where: { id: ids.userB } }).catch(() => undefined);
    }
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});

async function seed() {
  const hash = await bcrypt.hash(password, 8);
  const userA = await prisma.user.create({
    data: { email: emailA, name: "Iso A", passwordHash: hash },
  });
  const userB = await prisma.user.create({
    data: { email: emailB, name: "Iso B", passwordHash: hash },
  });
  ids.userA = userA.id;
  ids.userB = userB.id;

  const tenantA = await prisma.tenant.create({
    data: {
      name: `Iso Tenant A ${stamp}`,
      slug: `iso-a-${stamp}`,
      members: { create: { userId: userA.id, role: "owner" } },
      botSettings: { create: {} },
    },
  });
  const tenantB = await prisma.tenant.create({
    data: {
      name: `Iso Tenant B ${stamp}`,
      slug: `iso-b-${stamp}`,
      members: { create: { userId: userB.id, role: "owner" } },
      botSettings: { create: {} },
    },
  });
  ids.tenantA = tenantA.id;
  ids.tenantB = tenantB.id;

  const productB = await prisma.product.create({
    data: {
      tenantId: tenantB.id,
      name: "Secret Product B",
      price: 99000,
      active: true,
    },
  });
  ids.productB = productB.id;

  const contactB = await prisma.contact.create({
    data: {
      tenantId: tenantB.id,
      waJid: `62899${stamp.slice(-6)}@s.whatsapp.net`,
      phone: `+62899${stamp.slice(-6)}`,
      name: "Contact B",
    },
  });
  ids.contactB = contactB.id;

  const orderB = await prisma.order.create({
    data: {
      tenantId: tenantB.id,
      contactId: contactB.id,
      status: "draft",
      total: 99000,
      items: {
        create: {
          productId: productB.id,
          qty: 1,
          price: 99000,
        },
      },
    },
  });
  ids.orderB = orderB.id;

  const convB = await prisma.conversation.create({
    data: {
      tenantId: tenantB.id,
      contactId: contactB.id,
      status: "new",
      mode: "bot",
      lastMessagePreview: "secret-b",
    },
  });
  ids.convB = convB.id;

  const docB = await prisma.knowledgeDocument.create({
    data: {
      tenantId: tenantB.id,
      title: "Secret Doc B",
      sourceType: "txt",
      status: "ready",
    },
  });
  ids.docB = docB.id;

  const waB = await prisma.waSession.create({
    data: {
      tenantId: tenantB.id,
      label: "WA B",
      status: "disconnected",
    },
  });
  ids.waB = waB.id;
}

await seed();

async function login(email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json() as { token: string };
  assert.ok(body.token);
  return body.token;
}

const tokenA = await login(emailA);
const tokenB = await login(emailB);

function hdr(token: string, tenantId: string) {
  return {
    authorization: `Bearer ${token}`,
    "x-tenant-id": tenantId,
  };
}

test("A cannot use B tenant header (403)", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/products",
    headers: hdr(tokenA, ids.tenantB),
  });
  assert.equal(res.statusCode, 403);
});

test("A products list never includes B product", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/products?all=1",
    headers: hdr(tokenA, ids.tenantA),
  });
  assert.equal(res.statusCode, 200);
  const list = res.json() as { id: string }[];
  assert.ok(!list.some((p) => p.id === ids.productB));
});

test("A cannot GET B product by id (404)", async () => {
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/products`,
    headers: hdr(tokenA, ids.tenantA),
  });
  assert.equal(res.statusCode, 200);
  const patch = await app.inject({
    method: "PATCH",
    url: `/api/v1/products/${ids.productB}`,
    headers: hdr(tokenA, ids.tenantA),
    payload: { name: "hacked" },
  });
  assert.equal(patch.statusCode, 404);
});

test("A cannot GET B order by id (404)", async () => {
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/orders/${ids.orderB}`,
    headers: hdr(tokenA, ids.tenantA),
  });
  assert.equal(res.statusCode, 404);
});

test("A cannot PATCH B order (404)", async () => {
  const res = await app.inject({
    method: "PATCH",
    url: `/api/v1/orders/${ids.orderB}`,
    headers: hdr(tokenA, ids.tenantA),
    payload: { status: "paid" },
  });
  assert.equal(res.statusCode, 404);
});

test("A cannot read B conversation (404)", async () => {
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/conversations/${ids.convB}`,
    headers: hdr(tokenA, ids.tenantA),
  });
  assert.equal(res.statusCode, 404);
});

test("A conversation list excludes B", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/conversations",
    headers: hdr(tokenA, ids.tenantA),
  });
  assert.equal(res.statusCode, 200);
  const list = res.json() as { id: string }[];
  assert.ok(!list.some((c) => c.id === ids.convB));
});

test("A cannot read B WA session (404)", async () => {
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/wa/sessions/${ids.waB}`,
    headers: hdr(tokenA, ids.tenantA),
  });
  assert.equal(res.statusCode, 404);
});

test("B can still read own order", async () => {
  const res = await app.inject({
    method: "GET",
    url: `/api/v1/orders/${ids.orderB}`,
    headers: hdr(tokenB, ids.tenantB),
  });
  assert.equal(res.statusCode, 200);
  const order = res.json() as { id: string };
  assert.equal(order.id, ids.orderB);
});

test("missing X-Tenant-Id → 400", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/products",
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert.equal(res.statusCode, 400);
});

test("no auth → 401", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/api/v1/products",
    headers: { "x-tenant-id": ids.tenantA },
  });
  assert.equal(res.statusCode, 401);
});
