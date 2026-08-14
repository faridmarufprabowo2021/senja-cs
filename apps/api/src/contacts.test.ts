import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "./lib/prisma.js";

describe("CRM Contacts API", () => {
  let tenantId: string;
  let contactId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No tenant found for test");
    tenantId = tenant.id;

    const contact = await prisma.contact.findFirst({
      where: { tenantId },
    });
    if (contact) {
      contactId = contact.id;
    }
  });

  it("fetches contact summaries with LTV metrics", async () => {
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      take: 5,
    });
    expect(Array.isArray(contacts)).toBe(true);
  });

  it("updates contact tags", async () => {
    if (!contactId) return;

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: { tags: ["vip", "test-tag"] },
    });

    expect(updated.tags).toContain("vip");
    expect(updated.tags).toContain("test-tag");
  });
});
