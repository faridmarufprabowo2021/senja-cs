import type { BotSettings } from "@prisma/client";
import { prisma } from "./prisma.js";

const settingsCache = new Map<string, { data: BotSettings; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

export async function getCachedBotSettings(tenantId: string): Promise<BotSettings> {
  const now = Date.now();
  const hit = settingsCache.get(tenantId);
  if (hit && hit.expiresAt > now) {
    return hit.data;
  }

  const settings = await prisma.botSettings.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });

  settingsCache.set(tenantId, { data: settings, expiresAt: now + CACHE_TTL_MS });
  return settings;
}

export function invalidateBotSettingsCache(tenantId: string) {
  settingsCache.delete(tenantId);
}
