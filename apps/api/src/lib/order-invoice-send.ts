import { prisma } from "./prisma.js";
import {
  formatInvoiceText,
  formatPaidReceiptText,
  type InvoiceOrder,
} from "./invoice.js";
import { waManager } from "../wa/manager.js";
import { hub } from "../ws/hub.js";
import { mapConversation, mapMessage } from "./mappers.js";

export type SendInvoiceResult =
  | {
      ok: true;
      kind: "invoice" | "paid";
      text: string;
      orderId: string;
      conversationId: string;
      waMessageId: string | null;
    }
  | { ok: false; error: string; status: number };

type FullOrder = InvoiceOrder & {
  contactId: string;
  contact: { name: string; phone: string; waJid: string };
  tenantId: string;
};

export async function sendOrderInvoiceWa(opts: {
  tenantId: string;
  orderId: string;
  kind?: "invoice" | "paid" | "auto";
  agent?: { id: string; name: string } | null;
}): Promise<SendInvoiceResult> {
  const order = await prisma.order.findFirst({
    where: { id: opts.orderId, tenantId: opts.tenantId },
    include: {
      contact: true,
      items: { include: { product: true } },
      tenant: true,
    },
  });
  if (!order) return { ok: false, error: "Not found", status: 404 };

  const kind: "invoice" | "paid" =
    opts.kind === "invoice"
      ? "invoice"
      : opts.kind === "paid" ||
          order.status === "paid" ||
          order.status === "done"
        ? "paid"
        : "invoice";

  const text =
    kind === "paid"
      ? formatPaidReceiptText(order as FullOrder)
      : formatInvoiceText(order as FullOrder);

  let conv = await prisma.conversation.findFirst({
    where: {
      tenantId: opts.tenantId,
      contactId: order.contactId,
    },
    include: { contact: true, assignee: true },
    orderBy: { lastMessageAt: "desc" },
  });

  let sessionId = conv?.waSessionId ?? null;
  if (!sessionId) {
    const wa = await prisma.waSession.findFirst({
      where: { tenantId: opts.tenantId, status: "connected" },
      orderBy: { updatedAt: "desc" },
    });
    sessionId = wa?.id ?? null;
  }
  if (!sessionId) {
    return {
      ok: false,
      error: "Tidak ada sesi WhatsApp terhubung. Hubungkan di Channels dulu.",
      status: 400,
    };
  }

  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        tenantId: opts.tenantId,
        contactId: order.contactId,
        waSessionId: sessionId,
        status: "bot_active",
        mode: "bot",
        lastMessagePreview: text.slice(0, 120),
        lastMessageAt: new Date(),
      },
      include: { contact: true, assignee: true },
    });
  } else if (!conv.waSessionId) {
    conv = await prisma.conversation.update({
      where: { id: conv.id },
      data: { waSessionId: sessionId },
      include: { contact: true, assignee: true },
    });
  }

  let waMessageId: string | null = null;
  try {
    const sent = await waManager.sendText(
      sessionId,
      order.contact.waJid,
      text,
    );
    waMessageId = sent?.key?.id ?? null;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: detail.includes("WhatsApp")
        ? detail
        : `Gagal kirim WhatsApp: ${detail}`,
      status: 503,
    };
  }

  const now = new Date();
  const agent = opts.agent;
  // If agent.id is a pseudo-id (like "midtrans-system"), do not insert into senderId FK
  let validSenderId: string | null = null;
  if (agent?.id) {
    const userExists = await prisma.user.findUnique({
      where: { id: agent.id },
      select: { id: true },
    });
    if (userExists) validSenderId = userExists.id;
  }

  const message = await prisma.message.create({
    data: {
      tenantId: opts.tenantId,
      conversationId: conv.id,
      direction: "out",
      senderType: validSenderId ? "agent" : "system",
      senderId: validSenderId,
      senderName: agent?.name ?? "Sistem",
      type: "text",
      body: text,
      waMessageId,
    },
  });

  const updated = await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      lastMessageAt: now,
      lastMessagePreview: text.slice(0, 120),
    },
    include: { contact: true, assignee: true },
  });

  hub.toTenant(opts.tenantId, "message.created", mapMessage(message));
  hub.toTenant(
    opts.tenantId,
    "conversation.updated",
    mapConversation(updated),
  );

  return {
    ok: true,
    kind,
    text,
    orderId: order.id,
    conversationId: conv.id,
    waMessageId,
  };
}
