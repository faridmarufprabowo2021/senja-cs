import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "./lib/prisma.js";
import { createCampaign } from "./lib/campaigns.js";

describe("Broadcast Campaign Engine", () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("No tenant found for test");
    tenantId = tenant.id;
  });

  it("creates campaign and assigns recipients", async () => {
    const campaign = await createCampaign({
      tenantId,
      name: "Test Promo Campaign",
      message: "Halo {{name}}, Dapatkan diskon 20%!",
      delayMinSec: 1,
      delayMaxSec: 2,
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.name).toBe("Test Promo Campaign");
    expect(campaign.totalCount).toBeGreaterThanOrEqual(0);
  });
});
