import { prisma } from "./prisma.js";
import { hub } from "../ws/hub.js";

export type NotificationType = "payment_received" | "ai_handover" | "system";

export interface CreateNotificationParams {
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createAndEmitNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });

    // Real-time WebSocket emission to all connected client sessions for this tenant
    hub.toTenant(params.tenantId, "notification.created", notification);

    return notification;
  } catch (err) {
    console.error("[Notifications] Failed to create or emit notification:", err);
    return null;
  }
}
