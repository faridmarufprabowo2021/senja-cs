import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { checkShippingRates, trackWaybill } from "../services/shipping.js";

export async function shippingRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
  });

  // GET /api/v1/shipping/track?courier=jne&awb=123456789
  app.get("/shipping/track", async (request, reply) => {
    const query = request.query as { courier?: string; awb?: string; waybillNumber?: string };
    const waybillNumber = query.awb || query.waybillNumber || "";
    const courier = query.courier || "jne";

    if (!waybillNumber.trim()) {
      return reply.code(400).send({
        ok: false,
        message: "Nomor resi (awb) tidak boleh kosong",
      });
    }

    const result = await trackWaybill({
      courier,
      waybillNumber: waybillNumber.trim(),
    });

    return result;
  });

  // POST /api/v1/shipping/cost
  app.post("/shipping/cost", async (request, reply) => {
    const body = z
      .object({
        destination: z.string().min(1).max(120),
        origin: z.string().max(120).optional(),
        weightGrams: z.number().int().min(1).max(100000).optional().default(1000),
        courier: z.string().max(40).optional(),
      })
      .parse(request.body || {});

    const result = await checkShippingRates({
      destination: body.destination.trim(),
      origin: body.origin?.trim() || undefined,
      weightGrams: body.weightGrams,
      courier: body.courier?.trim() || undefined,
    });

    return result;
  });
}
