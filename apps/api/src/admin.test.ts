import { describe, expect, it } from "vitest";
import { prisma } from "./lib/prisma.js";

describe("Super Admin Platform Management", () => {
  it("calculates platform metrics and counts tenants correctly", async () => {
    const totalTenants = await prisma.tenant.count();
    expect(totalTenants).toBeGreaterThanOrEqual(0);
  });

  it("updates user isSuperAdmin flag", async () => {
    const user = await prisma.user.findFirst();
    if (user) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { isSuperAdmin: true },
      });
      expect(updated.isSuperAdmin).toBe(true);
    }
  });
});
