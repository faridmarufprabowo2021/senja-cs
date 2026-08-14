import type { FastifyInstance } from "fastify";
import { hub } from "../ws/hub.js";

export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket, request) => {
    const q = request.query as { token?: string; tenantId?: string };
    if (!q.token || !q.tenantId) {
      socket.close(4401, "token and tenantId required");
      return;
    }

    let user: { sub: string; email: string; name: string };
    try {
      user = app.jwt.verify<{ sub: string; email: string; name: string }>(
        q.token,
      );
    } catch {
      socket.close(4401, "invalid token");
      return;
    }

    hub.add({
      socket,
      userId: user.sub,
      tenantId: q.tenantId,
    });

    socket.send(
      JSON.stringify({
        event: "connected",
        data: { userId: user.sub, tenantId: q.tenantId },
      }),
    );
  });
}
