import { prisma } from "./prisma.js";
import { waManager } from "../wa/manager.js";
import { createMidtransTransaction } from "./midtrans.js";
import { type BotSettings as PrismaBotSettings } from "@prisma/client";

export type ReminderResult = {
  bookingRemindersSent: number;
  orderFollowupsSent: number;
  errors: string[];
};

function formatBookingDate(d: Date): string {
  return d.toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderRef(id: string): string {
  return `ORD-${id.slice(-4).toUpperCase()}`;
}

export async function processBookingReminders(tenantId?: string): Promise<number> {
  const now = new Date();

  // Get all tenants with connected WA sessions
  const tenants = await prisma.tenant.findMany({
    where: tenantId ? { id: tenantId } : {},
    select: { id: true, botSettings: true },
  });

  let sentCount = 0;

  for (const t of tenants) {
    const reminderEnabled = t.botSettings?.reminderEnabled ?? true;
    if (!reminderEnabled) continue;

    const startHours = t.botSettings?.reminderWindowStartHours ?? 30; // Farther window (e.g. 30h)
    const endHours = t.botSettings?.reminderWindowEndHours ?? 18;   // Nearer window (e.g. 18h)

    // Farther limit in future (e.g. now + 30h)
    const farFuture = new Date(now.getTime() + Math.max(startHours, endHours) * 3600 * 1000);
    // Nearer limit in future (e.g. now + 18h)
    const nearFuture = new Date(now.getTime() + Math.min(startHours, endHours) * 3600 * 1000);

    const pendingBookings = await prisma.booking.findMany({
      where: {
        tenantId: t.id,
        status: "confirmed",
        reminderSentAt: null,
        bookingDate: {
          gte: nearFuture,
          lte: farFuture,
        },
      },
      include: {
        contact: true,
        tenant: {
          include: {
            waSessions: {
              where: { status: "connected" },
              take: 1,
            },
          },
        },
      },
    });
    
    // Continue processing each booking (same as before but loop-level)
    for (const booking of pendingBookings) {
      const waSession = booking.tenant.waSessions[0];
      const dateStr = formatBookingDate(booking.bookingDate);
      const bodyText =
        `⏰ *Pengingat Jadwal Reservasi*\n\n` +
        `Halo *${booking.contact.name}*,\n` +
        `Sekadar mengingatkan jadwal reservasi *${booking.serviceName}* Anda pada *${dateStr}* besok.\n\n` +
        `📌 *Catatan*: Mohon hadir 15 menit sebelum jam tindakan.\n` +
        `Jika ada perubahan jadwal, silakan balas chat ini ya. Terima kasih! 🙏`;

      let sent = false;

      // Send via active WA Session if connected
      if (waSession) {
        try {
          await waManager.sendText(
            waSession.id,
            booking.contact.waJid,
            bodyText,
          );
          sent = true;
        } catch (err) {
          sent = false;
        }
      }

      // Always create message log in conversation
      const conv = await prisma.conversation.findFirst({
        where: { tenantId: booking.tenantId, contactId: booking.contactId },
        orderBy: { updatedAt: "desc" },
      });

      if (conv) {
        await prisma.message.create({
          data: {
            tenantId: booking.tenantId,
            conversationId: conv.id,
            direction: "out",
            senderType: "system",
            body: bodyText,
            metadata: { tool: "booking_reminder", bookingId: booking.id },
          },
        });
        await prisma.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessagePreview: `⏰ [Reminder H-1] ${booking.serviceName}`,
            lastMessageAt: new Date(),
          },
        });
      }

      // Mark reminderSentAt timestamp
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });

      sentCount++;
    }
  }

  return sentCount;
}

export async function processOrderFollowups(): Promise<number> {
  const now = new Date();
  // Target: Draft orders created between 24 hours and 72 hours ago
  const cutoff24h = new Date(now.getTime() - 24 * 3600 * 1000);
  const cutoff72h = new Date(now.getTime() - 72 * 3600 * 1000);

  const pendingOrders = await prisma.order.findMany({
    where: {
      status: "draft",
      followupSentAt: null,
      createdAt: {
        gte: cutoff72h,
        lte: cutoff24h,
      },
    },
    include: {
      items: { include: { product: true } },
      contact: true,
      tenant: {
        include: {
          waSessions: {
            where: { status: "connected" },
            take: 1,
          },
        },
      },
    },
  });

  let sentCount = 0;

  for (const order of pendingOrders) {
    const waSession = order.tenant.waSessions[0];

    // Generate Midtrans payment link if available
    let payLink = "";
    try {
      const midRes = await createMidtransTransaction({
        orderId: order.id,
        grossAmount: order.total,
        customerName: order.contact.name,
        customerPhone: order.contact.phone,
        items: order.items.map((it) => ({
          name: it.product.name,
          price: it.price,
          qty: it.qty,
        })),
      });
      if (midRes.ok && "redirectUrl" in midRes && midRes.redirectUrl) {
        payLink = midRes.redirectUrl;
      }
    } catch {
      /* fallback without link */
    }

    const payNote = payLink
      ? `💳 *Tautan Bayar Instan (QRIS/VA Midtrans)*:\n${payLink}\n\n`
      : "";

    const bodyText =
      `🔔 *Pengingat Pesanan*\n\n` +
      `Halo *${order.contact.name}*,\n` +
      `Pesanan Anda *#${orderRef(order.id)}* senilai *Rp${order.total.toLocaleString("id-ID")}* masih menunggu pembayaran.\n\n` +
      `${payNote}` +
      `Silakan selesaikan pembayaran untuk mengonfirmasi pesanan. Ketik *cs* jika ada kendala. Terima kasih!`;

    // Send via active WA Session if connected
    if (waSession) {
      await waManager.sendText(
        waSession.id,
        order.contact.waJid,
        bodyText,
      );
    }

    // Always create message log in conversation
    const conv = await prisma.conversation.findFirst({
      where: { tenantId: order.tenantId, contactId: order.contactId },
      orderBy: { updatedAt: "desc" },
    });

    if (conv) {
      await prisma.message.create({
        data: {
          tenantId: order.tenantId,
          conversationId: conv.id,
          direction: "out",
          senderType: "system",
          body: bodyText,
          metadata: { tool: "order_followup", orderId: order.id },
        },
      });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessagePreview: `🔔 [Follow-up] #${orderRef(order.id)}`,
          lastMessageAt: new Date(),
        },
      });
    }

    // Mark followupSentAt timestamp
    await prisma.order.update({
      where: { id: order.id },
      data: { followupSentAt: new Date() },
    });

    sentCount++;
  }

  return sentCount;
}

function midtransResUrl(res: { redirectUrl?: string }): string {
  return res.redirectUrl || "";
}

function removeUnusedFunctions() {}

export async function runAllReminders(): Promise<ReminderResult> {
  const errors: string[] = [];
  let bookingRemindersSent = 0;
  let orderFollowupsSent = 0;

  try {
    bookingRemindersSent = await processBookingReminders();
  } catch (err) {
    errors.push(`Booking reminder error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    orderFollowupsSent = await processOrderFollowups();
  } catch (err) {
    errors.push(`Order followup error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { bookingRemindersSent, orderFollowupsSent, errors };
}

let schedulerRunning = false;
const scheduleHourlyInterval = () => {
  if (schedulerRunning) return;
  schedulerRunning = true;

  // Run immediately on start
  console.log("[Scheduler] Starting automated booking/order reminder scheduler...");
  void runAllReminders().then((res) => {
    console.log(
      `[Scheduler] Initial run complete: ${res.bookingRemindersSent} booking reminders sent, ${res.orderFollowupsSent} order followups sent`,
    );
  }).catch((err) => {
    console.error("[Scheduler] Initial run failed:", err);
  });

  // Then every hour (3600s)
  setInterval(() => {
    void runAllReminders().then((res) => {
      console.log(
        `[Scheduler] Hourly run: ${res.bookingRemindersSent} booking reminders sent, ${res.orderFollowupsSent} order followups sent`,
      );
    }).catch((err) => {
      console.error("[Scheduler] Hourly run failed:", err);
    });
  }, 3600 * 1000);
};

export function startReminderScheduler() {
  if (process.env.NODE_ENV !== "production" && process.env.SKIP_CRON !== "true") {
    scheduleHourlyInterval();
  } else {
    console.log(
      "[Scheduler] Cron scheduler disabled (NODE_ENV=production or SKIP_CRON=true). Use /api/v1/reminders/run manually.",
    );
  }
}
