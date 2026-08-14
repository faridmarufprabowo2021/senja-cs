import { env } from "./lib/env.js";
import { buildApp } from "./app.js";
import { startReminderScheduler } from "./services/reminder-scheduler.js";

const app = await buildApp();

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  app.log.info(`API listening on http://localhost:${env.API_PORT}`);

  startReminderScheduler();

  // Restore only previously connected sessions (qr/pending need fresh user action).
  const { prisma } = await import("./lib/prisma.js");
  const { waManager } = await import("./wa/manager.js");
  const sessions = await prisma.waSession.findMany({
    where: { status: "connected" },
    take: 50,
  });
  for (const s of sessions) {
    void waManager.start(s.tenantId, s.id).catch((err) => {
      app.log.warn(
        { err, requestId: "boot", tenantId: s.tenantId, sessionId: s.id },
        "WA restore failed",
      );
    });
  }
  if (sessions.length) {
    app.log.info({ count: sessions.length }, "Restoring WA session(s)");
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
