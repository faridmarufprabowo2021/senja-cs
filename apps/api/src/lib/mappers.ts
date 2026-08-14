import type {
  Contact as DbContact,
  Conversation as DbConversation,
  Message as DbMessage,
  User,
  WaSession as DbWaSession,
} from "@prisma/client";
import type {
  Contact,
  Conversation,
  DashboardMetrics,
  Message,
  WaSession,
} from "@cs/shared";

export function mapContact(c: DbContact): Contact {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    avatarHue: c.avatarHue,
    tags: c.tags,
    lastMessageAt: c.lastMessageAt.toISOString(),
  };
}

export function mapConversation(
  conv: DbConversation & {
    contact?: DbContact | null;
    assignee?: User | null;
    aiAgent?: { id: string; name: string } | null;
  },
): Conversation {
  const contact = conv.contact
    ? mapContact(conv.contact)
    : {
        id: conv.contactId,
        name: "Pelanggan",
        phone: "",
        avatarHue: 200,
        tags: [],
        lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : new Date().toISOString(),
      };

  return {
    id: conv.id,
    contact,
    channel: (conv.channel as Conversation["channel"]) || "whatsapp",
    status: conv.status as Conversation["status"],
    mode: conv.mode as Conversation["mode"],
    waSessionId: conv.waSessionId || null,
    assignedTo: conv.assignedTo,
    assignedName: conv.assignee?.name ?? null,
    aiAgentId: conv.aiAgentId || conv.aiAgent?.id || null,
    aiAgentName: conv.aiAgent?.name ?? null,
    unreadCount: conv.unreadCount,
    lastMessagePreview: conv.lastMessagePreview,
    lastMessageAt: conv.lastMessageAt.toISOString(),
    tags: contact.tags ?? [],
  };
}

export function mapMessage(m: DbMessage): Message {
  return {
    id: m.id,
    conversationId: m.conversationId,
    channel: (m.channel as Message["channel"]) || "whatsapp",
    direction: m.direction as Message["direction"],
    senderType: m.senderType as Message["senderType"],
    senderName: m.senderName ?? undefined,
    type: m.type as Message["type"],
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    metadata: (m.metadata as Message["metadata"]) ?? undefined,
  };
}

export function mapWaSession(s: DbWaSession): WaSession {
  return {
    id: s.id,
    label: s.label,
    phone: s.phoneE164 ?? undefined,
    status: s.status as WaSession["status"],
    lastSeenAt: s.lastSeenAt?.toISOString(),
  };
}

export function emptyMetrics(): DashboardMetrics {
  return {
    openChats: 0,
    waitingAgent: 0,
    botResolvedPct: 0,
    avgFirstResponseSec: 0,
    messagesToday: 0,
  };
}
