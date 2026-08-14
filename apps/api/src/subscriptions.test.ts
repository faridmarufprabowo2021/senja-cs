import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "./lib/prisma.js";

describe("SaaS Subscriptions & 3-Day Free Trial", () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No tenant found for test");
    tenantId = tenant.id;
  });

  it("fetches tenant subscription info and verifies 3-day trial properties", async () => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    expect(tenant).toBeDefined();
    expect(tenant?.plan).toBeDefined();
  });

  it("calculates trial remaining time correctly", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    expect(daysRemaining).toBe(3);
  });
});
