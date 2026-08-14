import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { requireAuth, requireRole, requireTenant } from "../lib/auth.js";
import { checkMidtransStatus, createMidtransTransaction } from "../lib/midtrans.js";
import type { SubscriptionInfo, SubscriptionPlan, SubscriptionTransactionItem } from "@cs/shared";

const PLAN_PRICES: Record<"pro" | "enterprise", number> = {
  pro: 199000,
  enterprise: 499000,
};

export async function subscriptionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  app.get("/subscription", async (request) => {
    const tenant = request.tenant as any;
    return {
      plan: tenant.plan,
      expiresAt: tenant.planExpiresAt?.toISOString(),
    };
  });

  app.post(
    "/subscription/create-payment-link",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const body = z
        .object({
          plan: z.enum(["pro", "enterprise"]),
        })
        .parse(request.body);

      const tenantId = request.tenant.tenantId;
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
      });

      const amount = PLAN_PRICES[body.plan];
      const orderId = `SUB-${tenantId.slice(-6)}-${Date.now()}`;

      const tx = await prisma.subscriptionTransaction.create({
        data: {
          tenantId,
          plan: body.plan,
          amount,
          status: "pending",
        },
      });

      // Call Midtrans Snap Payment Link with tenant-specific keys
      const midtransRes = await createMidtransTransaction({
        orderId,
        grossAmount: amount,
        customerName: request.authUser.name || tenant.name,
        customerPhone: "",
        items: [
          {
            name: `Langganan Senja CS Paket ${body.plan.toUpperCase()}`,
            price: amount,
            qty: 1,
          },
        ],
        serverKey: tenant.midtransServerKey ?? env.MIDTRANS_SERVER_KEY,
        isProduction: tenant.midtransIsProduction ?? env.MIDTRANS_IS_PRODUCTION,
      });

      if (!midtransRes.ok) {
        await prisma.subscriptionTransaction.update({
          where: { id: tx.id },
          data: { status: "failed" },
        });
        return reply.code(400).send({
          error: midtransRes.error || "Gagal membuat tautan pembayaran Midtrans",
        });
      }

      const updatedTx = await prisma.subscriptionTransaction.update({
        where: { id: tx.id },
        data: {
          snapToken: midtransRes.token,
          snapRedirectUrl: midtransRes.redirectUrl,
        },
      });

      return {
        ok: true,
        transactionId: updatedTx.id,
        orderId,
        snapRedirectUrl: updatedTx.snapRedirectUrl,
      };
    },
  );

  app.post(
    "/subscription/check-status/:id",
    { preHandler: [requireRole("owner", "admin")] },
    async (request, reply) => {
      const tenantId = request.tenant.tenantId;
      const { id } = request.params as { id: string };

      const subTx = await prisma.subscriptionTransaction.findFirst({
        where: { id, tenantId },
      });

      if (!subTx) {
        return reply.code(404).send({ error: "Transaksi tidak ditemukan" });
      }

      if (subTx.status === "paid") {
        return { ok: true, status: "paid", message: "Transaksi sudah lunas" };
      }

      const midtransOrderIds = [
        `SUB-${tenantId.slice(-6)}-${subTx.createdAt.getTime()}`,
        id,
      ];

      let finalStatus: SubscriptionTransactionItem["status"] = "pending";
      let rawResponse: any;

      for (const orderId of midtransOrderIds) {
        const statusResult = await checkMidtransStatus(orderId);
        if (statusResult.ok && statusResult.raw) {
          rawResponse = statusResult.raw;
          const isPaid =
            statusResult.transactionStatus === "settlement" ||
            (statusResult.transactionStatus === "capture" &&
              (statusResult.fraudStatus === "accept" || !statusResult.fraudStatus));

          if (isPaid) {
            finalStatus = "paid" as any;
            break;
          }
        }
      }

      if (finalStatus === "paid" && subTx.status as any !== "paid") {
        const now = new Date();
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        const currentExp =
          tenant?.planExpiresAt && tenant.planExpiresAt.getTime() > now.getTime()
            ? tenant.planExpiresAt
            : now;
        const newExp = new Date(currentExp.getTime() + 30 * 24 * 60 * 60 * 1000);

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan: subTx.plan,
            planExpiresAt: newExp,
          },
        });

        await prisma.subscriptionTransaction.update({
          where: { id: subTx.id },
          data: {
            status: "paid",
            paidAt: now,
          },
        });
      }

      return {
        ok: true,
        status: subTx.status,
        details: rawResponse,
      };
    },
  );
}


