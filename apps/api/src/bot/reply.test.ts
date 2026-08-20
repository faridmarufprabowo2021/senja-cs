import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message, Conversation, Contact, AiAgent, Booking, Order, AiCorrection } from "@prisma/client";
import { mockDeep, MockProxy } from "vitest-mock-extended";
import { prisma } from "../lib/prisma.js";
import { checkReplyEligibility, BotReplyContext, checkBusinessHours, checkMaxTurns, resolveActiveAgent } from "./reply-pipeline.js";
import { buildCalendarContext, formatBookingSummary, formatOrderSummary, formatCorrectionContext } from "./reply-helpers.js";

// Mock Prisma client and dependencies
const mockPrisma = vi.hoisted(() => {
  return {
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    message: { findMany: vi.fn() },
    botSettings: { findUnique: vi.fn() },
  };
});

vi.mock("../lib/prisma.js", () => ({
  prisma: mockPrisma,
}));

vi.mock("../lib/bot-settings-cache.js", () => ({
  getCachedBotSettings: vi.fn().mockResolvedValue({
    enabled: true,
    businessHoursEnabled: false,
    maxBotTurns: 15,
    handoverKeywords: ["cs", "admin", "human"],
  }),
}));

vi.mock("./rate-limit.js", () => ({
  allowBotReply: vi.fn().mockReturnValue(true),
}));

vi.mock("./hours.js", () => ({
  isWithinBusinessHours: vi.fn().mockReturnValue(true),
}));

describe("Bot Reply Module Tests", () => {
  beforeEach(async () => {
    vi.resetAllMocks();

    const { getCachedBotSettings } = await import("../lib/bot-settings-cache.js");
    (getCachedBotSettings as any).mockResolvedValue({
      enabled: true,
      businessHoursEnabled: false,
      maxBotTurns: 15,
      handoverKeywords: ["cs", "admin", "human"],
    });

    const { allowBotReply } = await import("./rate-limit.js");
    (allowBotReply as any).mockReturnValue(true);

    const { isWithinBusinessHours } = await import("./hours.js");
    (isWithinBusinessHours as any).mockReturnValue(true);
  });

  describe("checkReplyEligibility", () => {
    it("returns not_found when conversation does not exist", async () => {
      (mockPrisma.conversation.findUnique as any).mockResolvedValue(null);

      const result = await checkReplyEligibility("non-existent-id");

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("not_found");
    });

    it("returns resolved when conversation status is resolved", async () => {
      const mockConversation = {
        id: "conv-1",
        tenantId: "tenant-1",
        status: "resolved",
        mode: "bot" as const,
        contactId: "contact-1",
        waSessionId: null,
        channel: "all",
        aiAgentId: null,
        assignee: null,
        contact: { name: "Test User", phone: "08123456789", waJid: "08123456789@s.whatsapp.net" },
      };
      (mockPrisma.conversation.findUnique as any).mockResolvedValue(mockConversation);

      const result = await checkReplyEligibility("conv-1");

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("resolved");
    });

    it("extracts latest customer message and effective text correctly", async () => {
      const mockConversation = {
        id: "conv-1",
        tenantId: "tenant-1",
        status: "new" as const,
        mode: "bot" as const,
        contactId: "contact-1",
        waSessionId: null,
        channel: "all",
        aiAgentId: null,
        assignee: null,
        contact: { name: "Test User", phone: "08123456789", waJid: "08123456789@s.whatsapp.net" },
      };

      const mockMessages = [
        { direction: "in", senderType: "customer" as const, body: "Saya mau pesan", createdAt: new Date(300) },
        { direction: "out", senderType: "bot" as const, body: "Hi!", createdAt: new Date(200) },
        { direction: "in", senderType: "customer" as const, body: "Hello", createdAt: new Date(100) },
        { direction: "out", senderType: "system" as const, body: "Welcome!", createdAt: new Date(50) },
      ];

      (mockPrisma.conversation.findUnique as any).mockResolvedValue(mockConversation);
      (mockPrisma.message.findMany as any).mockResolvedValue(mockMessages);

      const result = await checkReplyEligibility("conv-1");

      expect(result.ok).toBe(true);
      if (result.context) {
        expect(result.context.lastIn.body).toBe("Saya mau pesan");
        expect(result.context.effectiveUserText).toBe("Saya mau pesan");
      }
    });
  });

  describe("checkBusinessHours", () => {
    it("returns ok when hours are open", () => {
      const ctx: BotReplyContext = {
        conversation: {} as any,
        settings: { businessHoursEnabled: false } as any,
        chronological: [],
        lastIn: {} as any,
        effectiveUserText: "",
        activeTurnBotTurns: 0,
      };
      expect(checkBusinessHours(ctx)).toEqual({ ok: true });
    });
  });

  describe("checkMaxTurns", () => {
    it("returns not ok when max turns exceeded", () => {
      const ctx: BotReplyContext = {
        conversation: {} as any,
        settings: { maxBotTurns: 2 } as any,
        chronological: [],
        lastIn: {} as any,
        effectiveUserText: "",
        activeTurnBotTurns: 2,
      };
      expect(checkMaxTurns(ctx)).toEqual({ ok: false, reason: "max_turns" });
    });
  });

  describe("buildCalendarContext", () => {
    it("generates correct date strings in target timezone", () => {
      const now = new Date("2026-08-20T14:00:00+07:00");
      const tz = "Asia/Jakarta";
      const ctx = buildCalendarContext(now, tz);

      expect(ctx.isoToday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ctx.calendarTable).toContain("[HARI INI]");
      expect(ctx.calendarTable).toContain("[BESOK]");
    });
  });

  describe("formatBookingSummary", () => {
    it("formats empty bookings correctly", () => {
      const summary = formatBookingSummary([], "Asia/Jakarta");
      expect(summary).toBe("(Pelanggan ini belum memiliki riwayat reservasi/booking di database)");
    });

    it("formats non-empty bookings with details", () => {
      const bookings: Array<Booking & { note?: string | null }> = [
        {
          id: "bk-1",
          serviceName: "Cuci Mobil",
          bookingDate: new Date("2026-08-21T10:00:00"),
          status: "pending",
          note: null,
        } as any,
      ];
      const summary = formatBookingSummary(bookings, "Asia/Jakarta");
      expect(summary).toContain("ID: bk-1");
      expect(summary).toContain('Layanan: "Cuci Mobil"');
      expect(summary).toContain("Status: pending");
    });
  });

  describe("formatOrderSummary", () => {
    it("formats empty orders correctly", () => {
      const summary = formatOrderSummary([]);
      expect(summary).toBe("(Pelanggan ini belum memiliki riwayat order/pesanan di database)");
    });

    it("formats non-empty orders with price", () => {
      const orders: Array<Order> = [{ id: "ord-1", total: 150000, status: "paid" }] as any;
      const summary = formatOrderSummary(orders);
      expect(summary).toContain("Order ID: ord-1");
      expect(summary).toContain("Rp150.000");
    });
  });

  describe("formatCorrectionContext", () => {
    it("formats empty corrections correctly", () => {
      const context = formatCorrectionContext([]);
      expect(context).toBe("");
    });

    it("formats non-empty corrections", () => {
      const corrections: Array<AiCorrection> = [{ userQuery: "Harga berapa?", correctedReply: "Rp 50.000" }] as any;
      const context = formatCorrectionContext(corrections);
      expect(context).toContain("Jika ditanya hal terkait: \"Harga berapa?\"");
      expect(context).toContain("JAWABAN BENAR: \"Rp 50.000\"");
    });
  });
});
