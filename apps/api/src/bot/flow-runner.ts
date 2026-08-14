import { prisma } from "../lib/prisma.js";
import { waManager } from "../wa/manager.js";
import { hub } from "../ws/hub.js";
import { createAndEmitNotification } from "../lib/notifications.js";
import { retrieveChunks } from "./retrieve.js";
import { chatComplete } from "../lib/llm.js";
import { mapMessage, mapConversation } from "../lib/mappers.js";

export type FlowRunResult = {
  handled: boolean;
  handover?: boolean;
  flowId?: string;
  stepsExecuted?: number;
};

export async function runFlowForConversation(
  conversationId: string,
  messageText: string,
): Promise<FlowRunResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });

  if (!conversation || !conversation.contact) {
    return { handled: false };
  }

  const { tenantId, contact } = conversation;

  // Find connected WA session or fallback
  const dbWaSession = conversation.waSessionId
    ? await prisma.waSession.findUnique({ where: { id: conversation.waSessionId } })
    : await prisma.waSession.findFirst({
        where: { tenantId, status: "connected" },
      });
  const sessionId = dbWaSession?.id || conversation.waSessionId || "";

  // Helper to send text across WA or Instagram channel
  async function sendMessageText(text: string) {
    if (conversation?.channel === "instagram") {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (tenant?.igAccessToken) {
        const { sendInstagramMessage } = await import("../channels/instagram.driver.js");
        await sendInstagramMessage({
          recipientId: contact.phone.replace(/^IG:/, ""),
          text,
          accessToken: tenant.igAccessToken,
        });
        return;
      }
    }
    if (sessionId) {
      await waManager.sendText(sessionId, contact.waJid, text);
    }
  }

  // Helper to send media across WA or Instagram channel
  async function sendMessageMedia(opts: {
    isImage: boolean;
    buffer: Buffer;
    caption?: string;
    mimetype: string;
    fileName: string;
  }) {
    if (sessionId) {
      await waManager.sendMedia(sessionId, contact.waJid, opts);
    }
  }

  // Find active ConversationFlow for this tenant
  const activeFlow = await prisma.conversationFlow.findFirst({
    where: { tenantId, isActive: true },
  });

  if (!activeFlow) {
    return { handled: false };
  }

  const nodes = (activeFlow.nodesJson as any[]) || [];
  const edges = (activeFlow.edgesJson as any[]) || [];

  if (nodes.length === 0) {
    return { handled: false };
  }

  // Find Trigger Node
  const triggerNode = nodes.find((n) => n.type === "triggerNode" || n.type === "trigger");
  if (!triggerNode) {
    return { handled: false };
  }

  const triggerData = triggerNode.data || {};
  const triggerType = triggerData.triggerType || "all_messages"; // "all_messages" | "keyword"
  const keywords: string[] = (triggerData.keywords || "")
    .split(",")
    .map((k: string) => k.trim().toLowerCase())
    .filter(Boolean);

  const incomingLower = messageText.toLowerCase();

  if (triggerType === "keyword" && keywords.length > 0) {
    const matched = keywords.some((kw) => incomingLower.includes(kw));
    if (!matched) {
      return { handled: false };
    }
  }

  // Start graph traversal from trigger node
  let currentNode = triggerNode;
  const executionLogs: any[] = [];
  let steps = 0;
  const maxSteps = 15; // Safeguard against infinite loops

  while (currentNode && steps < maxSteps) {
    steps++;
    executionLogs.push({
      step: steps,
      nodeId: currentNode.id,
      type: currentNode.type,
      data: currentNode.data,
    });

    // Find outbound edges from current node
    const outboundEdges = edges.filter((e) => e.source === currentNode.id);

    // 1. MEDIA NODE / TEXT NODE
    if (currentNode.type === "mediaNode" || currentNode.type === "media") {
      const mediaUrl = currentNode.data?.mediaUrl;
      const caption = currentNode.data?.caption || currentNode.data?.label || "";
      const mediaType = currentNode.data?.mediaType || "image"; // "image" | "document" | "video"

      if (mediaUrl) {
        try {
          const res = await fetch(mediaUrl);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = res.headers.get("content-type") || "image/jpeg";

            await sendMessageMedia({
              isImage: mediaType === "image",
              buffer,
              caption: caption || undefined,
              mimetype: contentType,
              fileName: mediaType === "document" ? "katalog.pdf" : "media.jpg",
            });
          } else {
            await sendMessageText(`${caption}\n${mediaUrl}`);
          }
        } catch {
          await sendMessageText(`${caption}\n${mediaUrl}`);
        }
      } else if (caption) {
        await sendMessageText(caption);
      }

      // Record outbound message in DB
      const sentMsg = await prisma.message.create({
        data: {
          conversationId,
          tenantId,
          direction: "out",
          senderType: "bot",
          body: caption || `[File ${mediaType}]`,
          metadata: { mediaUrl: mediaUrl || null },
        },
      });

      hub.toTenant(tenantId, "message.created", mapMessage(sentMsg));
    }

    // 2. BUTTON NODE
    if (currentNode.type === "buttonNode" || currentNode.type === "button") {
      const label = currentNode.data?.label || "Silakan pilih menu di bawah ini:";
      const btn1 = currentNode.data?.btn1 ? `1️⃣ ${currentNode.data.btn1}` : "";
      const btn2 = currentNode.data?.btn2 ? `2️⃣ ${currentNode.data.btn2}` : "";
      const btn3 = currentNode.data?.btn3 ? `3️⃣ ${currentNode.data.btn3}` : "";
      
      const buttonOptions = [btn1, btn2, btn3].filter(Boolean).join("\n");
      const fullText = `${label}\n\n${buttonOptions}\n\n_Balas nomor atau teks pilihan Anda._`;

      await sendMessageText(fullText);

      const botMsg = await prisma.message.create({
        data: {
          conversationId,
          tenantId,
          direction: "out",
          senderType: "bot",
          body: fullText,
        },
      });

      hub.toTenant(tenantId, "message.created", mapMessage(botMsg));
    }

    // 3. ACTION NODE (QRIS / Payment Instructions)
    if (currentNode.type === "actionNode" || currentNode.type === "action") {
      const { getPaymentInfo } = await import("../tools/commerce.js");
      const payRes = await getPaymentInfo(tenantId, contact.id);

      await sendMessageText(payRes.text);

      const botMsg = await prisma.message.create({
        data: {
          conversationId,
          tenantId,
          direction: "out",
          senderType: "bot",
          body: payRes.text,
        },
      });

      hub.toTenant(tenantId, "message.created", mapMessage(botMsg));
    }

    // 4. INPUT NODE (Capture Customer Detail)
    if (currentNode.type === "inputNode" || currentNode.type === "input") {
      const promptText = currentNode.data?.label || "Silakan ketikkan detail / tanggapan Anda di bawah ini:";

      await sendMessageText(promptText);

      const botMsg = await prisma.message.create({
        data: {
          conversationId,
          tenantId,
          direction: "out",
          senderType: "bot",
          body: promptText,
        },
      });

      hub.toTenant(tenantId, "message.created", mapMessage(botMsg));
    }

    // 4. AI RAG NODE
    if (currentNode.type === "aiNode" || currentNode.type === "ai") {
      const promptContext = currentNode.data?.systemPrompt || "Jawab pertanyaan pelanggan dengan ramah dan informatif.";
      
      const chunks = await retrieveChunks(tenantId, messageText, 4);
      const ragInfo = chunks.map((c) => c.content || c.title).join("\n---\n");

      const completion = await chatComplete([
        { role: "system", content: `${promptContext}\n\nRELEVAN KNOWLEDGE BASE:\n${ragInfo}` },
        { role: "user", content: messageText },
      ]);

      const aiReplyText = completion.content || "Terima kasih telah menghubungi kami! Ada yang bisa kami bantu?";

      await sendMessageText(aiReplyText);

      const aiSourceChunks = chunks
        .filter((c) => c.score > 0)
        .slice(0, 3)
        .map((c) => ({
          id: c.id,
          documentId: c.documentId,
          title: c.title,
          score: c.score,
          snippet: c.content,
          fileUrl: c.fileUrl,
        }));

      const botMsg = await prisma.message.create({
        data: {
          conversationId,
          tenantId,
          direction: "out",
          senderType: "bot",
          body: aiReplyText,
          metadata: {
            aiSource: {
              query: messageText,
              engine: "pgvector HNSW (Cosine Similarity)",
              retrievedAt: new Date().toISOString(),
              chunks: aiSourceChunks,
            },
          },
        },
      });

      hub.toTenant(tenantId, "message.created", mapMessage(botMsg));

      // Check if any product was mentioned and auto-send product image if available
      const products = await prisma.product.findMany({
        where: { tenantId, imageUrl: { not: null } },
        take: 10,
      });

      const matchedProduct = products.find((p) => p.imageUrl && aiReplyText.toLowerCase().includes(p.name.toLowerCase()));
      if (matchedProduct?.imageUrl) {
        try {
          const imgRes = await fetch(matchedProduct.imageUrl);
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            await sendMessageMedia({
              isImage: true,
              buffer: buf,
              caption: `🖼️ Foto Produk: ${matchedProduct.name}`,
              mimetype: imgRes.headers.get("content-type") || "image/jpeg",
              fileName: "product.jpg",
            });
          }
        } catch {
          /* ignore media fetch failure */
        }
      }
    }

    // 5. HANDOVER NODE
    if (currentNode.type === "handoverNode" || currentNode.type === "handover") {
      const handoverNote = currentNode.data?.note || "Percakapan dialihkan ke Customer Service Manusia.";

      const updatedConv = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          mode: "human",
          status: "waiting_agent",
        },
        include: { contact: true, assignee: true },
      });

      hub.toTenant(tenantId, "conversation.updated", {
        conversation: mapConversation(updatedConv),
      });

      await createAndEmitNotification({
        tenantId,
        type: "ai_handover",
        title: "🚨 Chat Dialihkan ke CS Manusia",
        message: `Pelanggan ${contact.name} (${contact.phone}) memerlukan penanganan CS manusia.`,
        link: `/inbox?id=${conversationId}`,
        metadata: { conversationId, contactName: contact.name },
      });

      await sendMessageText(
        "Mohon tunggu sebentar ya kak, Customer Service kami akan segera melayani Anda 🙏",
      );

      // Save execution log
      await prisma.flowExecutionLog.create({
        data: {
          flowId: activeFlow.id,
          conversationId,
          status: "handover",
          currentNodeId: currentNode.id,
          logsJson: executionLogs,
        },
      });

      return { handled: true, handover: true, flowId: activeFlow.id, stepsExecuted: steps };
    }

    // 6. WEBHOOK NODE
    if (currentNode.type === "webhookNode" || currentNode.type === "webhook") {
      const targetUrl = currentNode.data?.webhookUrl;
      if (targetUrl) {
        void fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "flow.node.executed",
            tenantId,
            conversationId,
            contact: {
              name: contact.name,
              phone: contact.phone,
            },
            message: messageText,
            timestamp: new Date().toISOString(),
          }),
        }).catch((err) => {
          console.warn("[flow-runner] webhook dispatch error:", err);
        });
      }
    }

    // Determine next node from outbound edges
    if (outboundEdges.length === 0) {
      break;
    }

    // If condition node, evaluate target handle
    if (currentNode.type === "conditionNode" || currentNode.type === "condition") {
      const keywordsYes = (currentNode.data?.yesKeywords || "ya,beli,pesan,booking,setuju")
        .split(",")
        .map((k: string) => k.trim().toLowerCase());
      
      const isYes = keywordsYes.some((k: string) => incomingLower.includes(k));
      const targetHandle = isYes ? "yes" : "no";

      const matchedEdge = outboundEdges.find((e) => e.sourceHandle === targetHandle) || outboundEdges[0];
      currentNode = nodes.find((n) => n.id === matchedEdge.target);
    } else {
      // Default: follow first edge
      const nextEdge = outboundEdges[0];
      currentNode = nodes.find((n) => n.id === nextEdge.target);
    }
  }

  // Save execution telemetry
  await prisma.flowExecutionLog.create({
    data: {
      flowId: activeFlow.id,
      conversationId,
      status: "success",
      currentNodeId: currentNode?.id || null,
      logsJson: executionLogs,
    },
  });

  return { handled: true, flowId: activeFlow.id, stepsExecuted: steps };
}
