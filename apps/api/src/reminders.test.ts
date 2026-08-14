/**
 * Reminders & Follow-ups tests
 * Run: pnpm --filter @cs/api test:reminders
 * Requires Postgres (DATABASE_URL). Creates ephemeral tenant, cleans up.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { processBookingReminders, processOrderFollowups } from "./lib/reminders.js";

const stamp = Date.now().toString(36);
const ids = { tenant: "", contact: "", booking: "", order: "" };

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
    name: `Reminder Test ${stamp}`,
    slug: `rem-${stamp}`,
    botSettings: { create: {} },
  },
});
ids.tenant = tenant.id;

const contact = await prisma.contact.create({
  data: {
    tenantId: tenant.id,
    waJid: `62899${stamp.slice(-6)}@s.whatsapp.net`,
    phone: `+62899${stamp.slice(-6)}`,
    name: "Reminder Contact",
  },
});
ids.contact = contact.id;

// Booking tomorrow (24 hours from now)
const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
const booking = await prisma.booking.create({
  data: {
    tenantId: tenant.id,
    contactId: contact.id,
    serviceName: "Konsultasi Dokter Gigi",
    bookingDate: tomorrow,
    status: "confirmed",
  },
});
ids.booking = booking.id;

// Order created 30 hours ago (draft status)
const thirtyHoursAgo = new Date(Date.now() - 30 * 3600 * 1000);
const order = await prisma.order.create({
  data: {
    tenantId: tenant.id,
    contactId: contact.id,
    status: "draft",
    total: 75000,
    createdAt: thirtyHoursAgo,
  },
});
ids.order = order.id;

// Create conversation for contact log
await prisma.conversation.create({
  data: {
    tenantId: tenant.id,
    contactId: contact.id,
    status: "bot_active",
  },
});

test("processBookingReminders finds tomorrow booking & sets reminderSentAt", async () => {
  const count = await processBookingReminders();
  assert.ok(count >= 1);

  const fresh = await prisma.booking.findUniqueOrThrow({ where: { id: ids.booking } });
  assert.ok(fresh.reminderSentAt !== null);

  // Subsequent run should send 0 because reminderSentAt is set
  const countAgain = await processBookingReminders();
  assert.equal(countAgain, 0);
});

test("processOrderFollowups finds 24h+ draft order & sets followupSentAt", async () => {
  const count = await processOrderFollowups();
  assert.ok(count >= 1);

  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: ids.order } });
  assert.ok(fresh.followupSentAt !== null);

  // Subsequent run should send 0 because followupSentAt is set
  const countAgain = await processOrderFollowups();
  assert.equal(countAgain, 0);
});
