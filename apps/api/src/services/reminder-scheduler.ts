import { prisma } from "../lib/prisma.js";
import { waManager } from "../wa/manager.js";

/**
 * Render template variables like {{customerName}}, {{amount}}, {{qrisUrl}}, {{invoiceNumber}}
 */
export function renderReminderMessage(
  template: string,
  data: {
    customerName?: string;
    invoiceNumber?: string;
    amount?: number | string;
    dueDate?: string;
    qrisUrl?: string;
  },
): string {
  let msg = template;
  msg = msg.replace(/\{\{customerName\}\}/g, data.customerName || "Pelanggan");
  msg = msg.replace(/\{\{invoiceNumber\}\}/g, data.invoiceNumber || "-");
  msg = msg.replace(/\{\{amount\}\}/g, data.amount ? `Rp ${Number(data.amount).toLocaleString("id-ID")}` : "Rp 0");
  msg = msg.replace(/\{\{dueDate\}\}/g, data.dueDate || "Hari ini");
  msg = msg.replace(/\{\{qrisUrl\}\}/g, data.qrisUrl || "");
  return msg.trim();
}

/**
 * Send WhatsApp text message via waManager engine
 */
async function sendWaText(tenantId: string, phone: string, text: string): Promise<boolean> {
  try {
    const activeSessions = waManager.listActive(tenantId);
    let sessionId = activeSessions[0]?.sessionId;

    if (!sessionId) {
      const dbSession = await prisma.waSession.findFirst({
        where: { tenantId, status: "connected" },
      });
      if (!dbSession) {
        console.warn(`[reminder-scheduler] No connected WA session for tenant ${tenantId}`);
        return false;
      }
      sessionId = dbSession.id;
    }

    const cleanedPhone = phone.replace(/\D/g, "");
    let jid = cleanedPhone;
    if (!jid.endsWith("@s.whatsapp.net")) {
      if (jid.startsWith("0")) jid = "62" + jid.slice(1);
      jid = jid + "@s.whatsapp.net";
    }

    await waManager.sendText(sessionId, jid, text);
    return true;
  } catch (err) {
    console.error("[reminder-scheduler] Failed to send WA message:", err);
    return false;
  }
}

/**
 * Execute automated reminder check loop across active tenants
 */
export async function runReminderCheck(): Promise<{ processed: number; sent: number }> {
  let processed = 0;
  let sent = 0;

  try {
    const rules = await prisma.reminderRule.findMany({
      where: { isActive: true },
      include: { tenant: true },
    });

    for (const rule of rules) {
      if (rule.triggerType === "UNPAID_INVOICE") {
        // Query orders/invoices that are draft/confirmed (unpaid) and created before delayMinutes
        const cutoff = new Date(Date.now() - rule.delayMinutes * 60 * 1000);
        const unpaidOrders = await prisma.order.findMany({
          where: {
            tenantId: rule.tenantId,
            status: { in: ["draft", "confirmed"] },
            createdAt: { lte: cutoff },
          },
          include: { contact: true },
          take: 20,
        });

        for (const order of unpaidOrders) {
          processed++;
          const existingLog = await prisma.reminderLog.findFirst({
            where: {
              tenantId: rule.tenantId,
              ruleId: rule.id,
              phone: order.contact.waJid,
              status: "SENT",
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          });

          if (existingLog) continue;

          const renderedText = renderReminderMessage(rule.messageTemplate, {
            customerName: order.contact.name || "Pelanggan",
            invoiceNumber: `INV-${order.id.slice(-6).toUpperCase()}`,
            amount: order.total,
            dueDate: new Date(order.createdAt.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString("id-ID"),
          });

          const success = await sendWaText(rule.tenantId, order.contact.waJid, renderedText);

          await prisma.reminderLog.create({
            data: {
              tenantId: rule.tenantId,
              ruleId: rule.id,
              recipientName: order.contact.name || "Pelanggan",
              phone: order.contact.waJid,
              message: renderedText,
              status: success ? "SENT" : "FAILED",
              errorMessage: success ? null : "WA Session disconnected / failed to send",
              sentAt: success ? new Date() : null,
            },
          });

          if (success) sent++;
        }
      } else if (rule.triggerType === "BOOKING_SCHEDULE") {
        // H-1 Booking Reminder (e.g. delayMinutes = 1440mins / 24 hours)
        const windowStart = new Date(Date.now() + (rule.delayMinutes - 180) * 60 * 1000);
        const windowEnd = new Date(Date.now() + (rule.delayMinutes + 180) * 60 * 1000);

        const upcomingBookings = await prisma.booking.findMany({
          where: {
            tenantId: rule.tenantId,
            status: "confirmed",
            bookingDate: {
              gte: windowStart,
              lte: windowEnd,
            },
          },
          include: { contact: true },
          take: 20,
        });

        for (const booking of upcomingBookings) {
          processed++;
          const existingLog = await prisma.reminderLog.findFirst({
            where: {
              tenantId: rule.tenantId,
              ruleId: rule.id,
              phone: booking.contact.waJid,
              status: "SENT",
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          });

          if (existingLog) continue;

          const dateStr = booking.bookingDate.toLocaleString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          const renderedText = renderReminderMessage(rule.messageTemplate, {
            customerName: booking.contact.name || "Pelanggan",
            dueDate: dateStr,
          });

          const success = await sendWaText(rule.tenantId, booking.contact.waJid, renderedText);

          await prisma.reminderLog.create({
            data: {
              tenantId: rule.tenantId,
              ruleId: rule.id,
              recipientName: booking.contact.name || "Pelanggan",
              phone: booking.contact.waJid,
              message: renderedText,
              status: success ? "SENT" : "FAILED",
              errorMessage: success ? null : "WA Session disconnected / failed to send",
              sentAt: success ? new Date() : null,
            },
          });

          if (success) sent++;
        }
      } else if (rule.triggerType === "CUSTOM_FOLLOWUP") {
        // Customer satisfaction follow-up after completed/paid transaction
        const cutoff = new Date(Date.now() - rule.delayMinutes * 60 * 1000);
        const doneOrders = await prisma.order.findMany({
          where: {
            tenantId: rule.tenantId,
            status: { in: ["paid", "done"] },
            updatedAt: { lte: cutoff },
          },
          include: { contact: true },
          take: 20,
        });

        for (const order of doneOrders) {
          processed++;
          const existingLog = await prisma.reminderLog.findFirst({
            where: {
              tenantId: rule.tenantId,
              ruleId: rule.id,
              phone: order.contact.waJid,
              status: "SENT",
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 1 follow-up per week
            },
          });

          if (existingLog) continue;

          const renderedText = renderReminderMessage(rule.messageTemplate, {
            customerName: order.contact.name || "Pelanggan",
            invoiceNumber: `INV-${order.id.slice(-6).toUpperCase()}`,
            amount: order.total,
          });

          const success = await sendWaText(rule.tenantId, order.contact.waJid, renderedText);

          await prisma.reminderLog.create({
            data: {
              tenantId: rule.tenantId,
              ruleId: rule.id,
              recipientName: order.contact.name || "Pelanggan",
              phone: order.contact.waJid,
              message: renderedText,
              status: success ? "SENT" : "FAILED",
              errorMessage: success ? null : "WA Session disconnected / failed to send",
              sentAt: success ? new Date() : null,
            },
          });

          if (success) sent++;
        }
      }
    }
  } catch (err) {
    console.error("[reminder-scheduler] Error running reminder check loop:", err);
  }

  return { processed, sent };
}

import { runFollowupCheck } from "../bot/followup-worker.js";

/**
 * Start periodic background scheduler timer (runs every 60 seconds)
 */
export function startReminderScheduler() {
  console.log("[reminder-scheduler] WhatsApp Reminder Engine & AI Follow-Up Worker started (Interval: 60s)");
  setInterval(() => {
    void runReminderCheck();
    void runFollowupCheck();
  }, 60 * 1000);
}
