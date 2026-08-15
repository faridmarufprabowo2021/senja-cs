import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import { env } from "./lib/env.js";
import { authRoutes } from "./routes/auth.js";
import { tenantRoutes } from "./routes/tenants.js";
import { waRoutes } from "./routes/wa.js";
import { inboxRoutes } from "./routes/inbox.js";
import { wsRoutes } from "./routes/ws.js";
import { knowledgeRoutes } from "./routes/knowledge.js";
import { botRoutes } from "./routes/bot.js";
import { commerceRoutes } from "./routes/commerce.js";
import { bookingRoutes } from "./routes/bookings.js";
import { bookingImportRoutes } from "./routes/bookings-import.js";
import { paymentRoutes } from "./routes/payments.js";
import { reminderSettingsRoutes } from "./routes/reminder-settings.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { contactRoutes } from "./routes/contacts.js";
import { subscriptionRoutes } from "./routes/subscriptions.js";
import { adminRoutes } from "./routes/admin.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { notificationRoutes } from "./routes/notifications.js";
import { flowRoutes } from "./routes/flows.js";
import { evaluationRoutes } from "./routes/evaluations.js";
import { instagramRoutes } from "./routes/instagram.js";
import { aiAgentRoutes } from "./routes/ai-agents.js";
import { promoRoutes } from "./routes/promos.js";

export type BuildAppOptions = {
  logger?: boolean | object;
};

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : opts.logger ?? {
            level: env.NODE_ENV === "production" ? "info" : "debug",
          },
    genReqId: (req) =>
      (req.headers["x-request-id"] as string | undefined)?.trim() ||
      randomUUID(),
    requestIdHeader: "x-request-id",
  });

  await app.register(cors, {
    origin: [
      env.WEB_URL,
      env.CORS_ORIGIN,
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Tenant-Id",
      "X-Request-Id",
      "Accept",
    ],
    exposedHeaders: ["X-Request-Id"],
  });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(websocket);
  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024 },
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.addHook("onResponse", async (request, reply) => {
    const tenantId = request.tenant?.tenantId;
    const params = request.params as { id?: string; sessionId?: string };
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
        ...(tenantId ? { tenantId } : {}),
        ...(params?.id ? { resourceId: params.id } : {}),
        ...(params?.sessionId ? { sessionId: params.sessionId } : {}),
      },
      "request completed",
    );
  });

  app.get("/health", async () => ({ ok: true, service: "cs-api" }));

  app.get("/api/v1/media/*", async (request, reply) => {
    const pathMod = await import("node:path");
    const fs = await import("node:fs");
    const star = (request.params as { "*": string })["*"] || "";
    const safe = star.replace(/\.\./g, "").replace(/^\/+/, "");
    const abs = pathMod.join(env.STORAGE_LOCAL_PATH, safe);
    if (!abs.startsWith(pathMod.resolve(env.STORAGE_LOCAL_PATH))) {
      return reply.code(400).send({ error: "Invalid path" });
    }
    if (!fs.existsSync(abs)) return reply.code(404).send({ error: "Not found" });
    return reply.send(fs.createReadStream(abs));
  });

  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(tenantRoutes, { prefix: "/api/v1" });
  await app.register(waRoutes, { prefix: "/api/v1" });
  await app.register(inboxRoutes, { prefix: "/api/v1" });
  await app.register(knowledgeRoutes, { prefix: "/api/v1" });
  await app.register(botRoutes, { prefix: "/api/v1" });
  await app.register(commerceRoutes, { prefix: "/api/v1" });
  await app.register(bookingRoutes, { prefix: "/api/v1" });
  await app.register(bookingImportRoutes, { prefix: "/api/v1" });
  await app.register(paymentRoutes, { prefix: "/api/v1" });
  await app.register(paymentRoutes, { prefix: "/api" });
  await app.register(reminderSettingsRoutes, { prefix: "/api/v1" });
  await app.register(campaignRoutes, { prefix: "/api/v1" });
  await app.register(contactRoutes, { prefix: "/api/v1" });
  await app.register(subscriptionRoutes, { prefix: "/api/v1" });
  await app.register(adminRoutes, { prefix: "/api/v1" });
  await app.register(analyticsRoutes, { prefix: "/api/v1/analytics" });
  await app.register(notificationRoutes, { prefix: "/api/v1" });
  await app.register(flowRoutes, { prefix: "/api/v1" });
  await app.register(evaluationRoutes, { prefix: "/api/v1" });
  await app.register(instagramRoutes, { prefix: "/api/v1" });
  await app.register(aiAgentRoutes, { prefix: "/api/v1" });
  await app.register(promoRoutes, { prefix: "/api/v1" });
  const { shippingRoutes } = await import("./routes/shipping.js");
  await app.register(shippingRoutes, { prefix: "/api/v1" });
  const { pipelineRoutes } = await import("./routes/pipeline.js");
  await app.register(pipelineRoutes, { prefix: "/api/v1" });
  const { reminderRoutes } = await import("./routes/reminders.js");
  await app.register(reminderRoutes, { prefix: "/api/v1" });
  await app.register(wsRoutes, { prefix: "/api/v1" });

  app.setErrorHandler((err, req, reply) => {
    if (err && typeof err === "object" && "issues" in err) {
      return reply.code(400).send({
        error: "Validation error",
        details: err,
        requestId: req.id,
      });
    }
    req.log.error(
      {
        err,
        requestId: req.id,
        tenantId: req.tenant?.tenantId,
      },
      err instanceof Error ? err.message : "Internal error",
    );
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status).send({
      error: err instanceof Error ? err.message : "Internal error",
      requestId: req.id,
    });
  });

  // Background timer for automated reminders (every 15 minutes)
  const timer = setInterval(() => {
    import("./lib/reminders.js")
      .then((reminders) => reminders.runAllReminders())
      .catch((err: Error) => {
        app.log.warn({ err }, "failed running automated reminders interval");
      });
  }, 15 * 60 * 1000);

  // Background timer for automated idle follow-ups (every 2 minutes)
  const followupTimer = setInterval(() => {
    import("./bot/followup-worker.js")
      .then((worker) => worker.runFollowupCheck())
      .catch((err: Error) => {
        app.log.warn({ err }, "failed running automated followups interval");
      });
  }, 2 * 60 * 1000);

  // Background timer for automated Daily Executive Report (every 60 seconds)
  const dailyReportTimer = setInterval(() => {
    import("./services/daily-report-scheduler.js")
      .then((scheduler) => scheduler.checkAndDispatchDailyReports())
      .catch((err: Error) => {
        app.log.warn({ err }, "failed running automated daily report interval");
      });
  }, 60 * 1000);

  app.addHook("onClose", async () => {
    clearInterval(timer);
    clearInterval(followupTimer);
    clearInterval(dailyReportTimer);
  });

  return app;
}
