import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { verifyMidtransSignature } from "../lib/midtrans.js";
import { sendOrderInvoiceWa } from "../lib/order-invoice-send.js";
import { hub } from "../ws/hub.js";
import { createAndEmitNotification } from "../lib/notifications.js";
import { analyzeConversationForContact } from "../bot/analytics.js";

export async function paymentRoutes(app: FastifyInstance) {
  /**
   * Midtrans Webhook Receiver Endpoint
   * Midtrans posts transaction status updates here.
   */
  async function handleMidtransWebhook(request: any, reply: any) {
    const payload = request.body as any;
    request.log.info({ payload }, "received Midtrans webhook notification");

    if (!payload || !payload.order_id) {
      request.log.info({ payload }, "Midtrans test notification / ping received");
      return { ok: true, status: "test_notification_received", message: "Midtrans webhook endpoint active" };
    }

    const { order_id, transaction_status, fraud_status, signature_key, status_code, gross_amount } = payload;

    // Verify SHA-512 Signature Hash
    const isValidSignature = verifyMidtransSignature({
      order_id,
      status_code,
      gross_amount,
      signature_key,
    });

    if (!isValidSignature) {
      // Production: tolak keras — payload palsu bisa menandai order "paid" ilegal.
      // Sandbox: toleran agar manual testing via curl/simulator tidak terblokir.
      if (env.MIDTRANS_IS_PRODUCTION) {
        request.log.warn({ order_id }, "rejected: invalid Midtrans signature");
        return reply.code(401).send({ error: "Invalid signature" });
      }
      request.log.warn(
        { order_id },
        "invalid Midtrans signature — accepted (sandbox mode)",
      );
    }

    // Determine if payment is settled / lunas
    const isPaid =
      transaction_status === "settlement" ||
      transaction_status === "capture" && (fraud_status === "accept" || !fraud_status);

    if (!isPaid) {
      request.log.info({ order_id, transaction_status }, "payment status update (not paid yet)");
      return { ok: true, status: transaction_status };
    }

    // Handle Subscription Payment (order_id starts with "SUB-" or matches subscriptionTransaction ID)
    let pendingSub = null;
    const cleanSubId = order_id.replace(/^SUB-/, "");
    if (order_id.startsWith("SUB-")) {
      pendingSub = await prisma.subscriptionTransaction.findUnique({
        where: { id: cleanSubId },
      });
    } else {
      // Check if ID explicitly exists in subscriptionTransaction table first
      pendingSub = await prisma.subscriptionTransaction.findUnique({
        where: { id: order_id },
      });
    }

    if (pendingSub) {
        const now = new Date();
        const tenant = await prisma.tenant.findUnique({
          where: { id: pendingSub.tenantId },
        });
        const currentExp =
          tenant?.planExpiresAt && tenant.planExpiresAt.getTime() > now.getTime()
            ? tenant.planExpiresAt
            : now;
        const newExp = new Date(currentExp.getTime() + 30 * 24 * 60 * 60 * 1000);

        await prisma.tenant.update({
          where: { id: pendingSub.tenantId },
          data: {
            plan: pendingSub.plan,
            planExpiresAt: newExp,
          },
        });

        await prisma.subscriptionTransaction.update({
          where: { id: pendingSub.id },
          data: {
            status: "paid",
            paidAt: now,
          },
        });

        // Emit real-time payment notification & chime alert for subscription payment
        void createAndEmitNotification({
          tenantId: pendingSub.tenantId,
          type: "payment_received",
          title: "💰 Pembayaran Langganan Lunas",
          message: `Pembayaran Langganan Paket ${pendingSub.plan.toUpperCase()} sebesar Rp ${pendingSub.amount.toLocaleString("id-ID")} telah DITERIMA!`,
          link: "/settings/billing",
          metadata: {
            subscriptionId: pendingSub.id,
            plan: pendingSub.plan,
            amount: pendingSub.amount,
          },
        });

        request.log.info(
          { tenantId: pendingSub.tenantId, plan: pendingSub.plan },
          "subscription payment completed via Midtrans Webhook",
        );
        return { ok: true, subscriptionId: pendingSub.id, plan: pendingSub.plan };
      }

    // Find corresponding Order record by ID or suffix reference
    const order =
      (await prisma.order.findUnique({ where: { id: order_id } })) ||
      (await prisma.order.findFirst({
        where: {
          OR: [
            { id: { endsWith: order_id.replace(/^#|^ORD-/, "") } },
            { id: order_id },
          ],
        },
      }));

    if (!order) {
      request.log.warn({ order_id }, "order not found for Midtrans payment");
      return reply.code(404).send({ error: "Order not found" });
    }

    // If order already marked paid, return duplicate ok
    if (order.status === "paid") {
      return { ok: true, message: "Order already paid" };
    }

    // Mark Order status as paid in Prisma DB
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "paid" },
    });

    hub.toTenant(updated.tenantId, "order.updated", updated);

    // Auto-update AI Sentiment & Revenue Analytics for this customer
    void analyzeConversationForContact(updated.tenantId, updated.contactId);

    // Emit real-time payment notification & chime alert to CS agents/admin
    void createAndEmitNotification({
      tenantId: updated.tenantId,
      type: "payment_received",
      title: "💰 Pemasukan Baru (Midtrans QRIS)",
      message: `Pembayaran Lunas untuk Order #${updated.id.slice(-6).toUpperCase()} sebesar Rp ${updated.total.toLocaleString("id-ID")}`,
      link: "/orders",
      metadata: {
        orderId: updated.id,
        total: updated.total,
      },
    });

    request.log.info({ orderId: updated.id }, "order marked paid via Midtrans Webhook");

    // B3 Auto-Nota: Send Paid Receipt automatically to customer via WhatsApp
    const sentReceipt = await sendOrderInvoiceWa({
      tenantId: updated.tenantId,
      orderId: updated.id,
      kind: "paid",
      agent: {
        id: "midtrans-system",
        name: "Midtrans Auto-Payment",
      },
    });

    if (sentReceipt.ok) {
      request.log.info({ orderId: updated.id }, "B3 paid receipt auto-sent to customer WA via Midtrans Webhook");
    } else {
      request.log.warn(
        { orderId: updated.id, error: sentReceipt.error },
        "B3 paid receipt failed to send via WA",
      );
    }

    return { ok: true, orderId: updated.id, status: "paid" };
  }

  app.get("/payments/midtrans-webhook", async () => ({ ok: true, status: "active", message: "Midtrans webhook endpoint active" }));
  app.get("/midtrans-webhook", async () => ({ ok: true, status: "active", message: "Midtrans webhook endpoint active" }));
  app.post("/payments/midtrans-webhook", handleMidtransWebhook);
  app.post("/midtrans-webhook", handleMidtransWebhook);
}
