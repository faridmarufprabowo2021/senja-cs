import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";

const flowSchema = z.object({
  name: z.string().min(1, "Nama flow wajib diisi"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  nodesJson: z.any().optional(),
  edgesJson: z.any().optional(),
});

export async function flowRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    await requireTenant(request, reply);
  });

  // GET /flows - List all conversation flows for tenant
  app.get("/flows", async (request) => {
    const tenantId = request.tenant.tenantId;
    const flows = await prisma.conversationFlow.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });

    return { ok: true, data: flows };
  });

  // GET /flows/:id - Get single flow by ID
  app.get("/flows/:id", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const { id } = request.params as { id: string };

    const flow = await prisma.conversationFlow.findFirst({
      where: { id, tenantId },
    });

    if (!flow) {
      return reply.code(404).send({ ok: false, error: "Flow tidak ditemukan" });
    }

    return { ok: true, data: flow };
  });

  // POST /flows - Create new conversation flow
  app.post("/flows", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const parse = flowSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ ok: false, error: parse.error.format() });
    }

    const { name, description, isActive, nodesJson, edgesJson } = parse.data;

    // If making active, option to deactivate existing active flows
    if (isActive) {
      await prisma.conversationFlow.updateMany({
        where: { tenantId },
        data: { isActive: false },
      });
    }

    const flow = await prisma.conversationFlow.create({
      data: {
        tenantId,
        name,
        description: description || null,
        isActive: isActive ?? true,
        nodesJson: nodesJson || [
          {
            id: "start-1",
            type: "triggerNode",
            position: { x: 250, y: 50 },
            data: { label: "Pesan WA Masuk", triggerType: "all_messages" },
          },
        ],
        edgesJson: edgesJson || [],
      },
    });

    return reply.code(201).send({ ok: true, data: flow });
  });

  // PUT /flows/:id - Update existing conversation flow (nodes, edges, settings)
  app.put("/flows/:id", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const { id } = request.params as { id: string };

    const flow = await prisma.conversationFlow.findFirst({
      where: { id, tenantId },
    });

    if (!flow) {
      return reply.code(404).send({ ok: false, error: "Flow tidak ditemukan" });
    }

    const parse = flowSchema.partial().safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ ok: false, error: parse.error.format() });
    }

    const { name, description, isActive, nodesJson, edgesJson } = parse.data;

    if (isActive === true) {
      await prisma.conversationFlow.updateMany({
        where: { tenantId, id: { not: id } },
        data: { isActive: false },
      });
    }

    const updated = await prisma.conversationFlow.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(nodesJson !== undefined ? { nodesJson } : {}),
        ...(edgesJson !== undefined ? { edgesJson } : {}),
      },
    });

    return { ok: true, data: updated };
  });

  // DELETE /flows/:id - Delete flow
  app.delete("/flows/:id", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const { id } = request.params as { id: string };

    const flow = await prisma.conversationFlow.findFirst({
      where: { id, tenantId },
    });

    if (!flow) {
      return reply.code(404).send({ ok: false, error: "Flow tidak ditemukan" });
    }

    await prisma.conversationFlow.delete({ where: { id } });

    return { ok: true, message: "Flow berhasil dihapus" };
  });

  // POST /flows/generate - Generate flow graph via AI prompt/preset
  app.post("/flows/generate", async (request, reply) => {
    const tenantId = request.tenant.tenantId;
    const { prompt, presetType } = request.body as { prompt?: string; presetType?: string };

    if (!prompt && !presetType) {
      return reply.code(400).send({ ok: false, error: "Prompt atau presetType wajib diisi" });
    }

    const { generateFlowFromPrompt } = await import("../bot/flow-generator.js");
    const generated = await generateFlowFromPrompt(prompt || "", presetType);

    // Deactivate existing active flows when new AI flow is generated
    await prisma.conversationFlow.updateMany({
      where: { tenantId },
      data: { isActive: false },
    });

    const newFlow = await prisma.conversationFlow.create({
      data: {
        tenantId,
        name: generated.name || "Alur AI Baru",
        description: generated.description || "Alur otomatisasi yang dihasilkan oleh AI",
        isActive: true,
        nodesJson: generated.nodes || [],
        edgesJson: generated.edges || [],
      },
    });

    return reply.code(201).send({ ok: true, data: newFlow });
  });

  // POST /flows/simulate - Dry-run simulation of flow execution for live simulator widget
  app.post("/flows/simulate", async (request, reply) => {
    const { nodes, edges, messageText } = request.body as {
      nodes: any[];
      edges: any[];
      messageText: string;
    };

    if (!Array.isArray(nodes) || !messageText) {
      return reply.code(400).send({ ok: false, error: "Nodes & messageText wajib diisi" });
    }

    const executedNodeIds: string[] = [];
    const botReplies: Array<{
      type: "text" | "media" | "qris" | "handover" | "buttons";
      text?: string;
      caption?: string;
      mediaUrl?: string;
      buttons?: string[];
    }> = [];

    const triggerNode = nodes.find((n) => n.type === "triggerNode" || n.type === "trigger");
    if (!triggerNode) {
      return { ok: true, executedNodeIds: [], replies: [{ type: "text", text: "Sistem: Tidak ada Trigger Node pada kanvas alur." }] };
    }

    const incomingLower = messageText.toLowerCase();

    // Check Trigger Node Keywords
    if (triggerNode.data?.triggerType === "keyword") {
      const keywords: string[] = (triggerNode.data?.keywords || "")
        .split(",")
        .map((k: string) => k.trim().toLowerCase())
        .filter(Boolean);

      if (keywords.length > 0) {
        const matched = keywords.some((kw) => incomingLower.includes(kw));
        if (!matched) {
          return {
            ok: true,
            executedNodeIds: [],
            replies: [
              {
                type: "text",
                text: `ℹ️ Pesan "${messageText}" tidak memicu kata kunci trigger (${keywords.join(", ")}). Coba ketik kata kunci tersebut!`,
              },
            ],
          };
        }
      }
    }

    let currentNode = triggerNode;
    let steps = 0;
    const maxSteps = 12;

    while (currentNode && steps < maxSteps) {
      steps++;
      executedNodeIds.push(currentNode.id);

      if (currentNode.type?.includes("media")) {
        botReplies.push({
          type: "media",
          caption: currentNode.data?.caption || "Berikut katalog foto/PDF produk kami 📦",
          mediaUrl: currentNode.data?.mediaUrl,
        });
      } else if (currentNode.type?.includes("button")) {
        const btns = [currentNode.data?.btn1, currentNode.data?.btn2].filter(Boolean);
        botReplies.push({
          type: "buttons",
          text: currentNode.data?.label || "Silakan pilih salah satu menu di bawah:",
          buttons: btns.length > 0 ? btns : ["Pilihan 1", "Pilihan 2"],
        });
      } else if (currentNode.type?.includes("ai")) {
        const tenantId = request.tenant.tenantId;
        const { retrieveChunks } = await import("../bot/retrieve.js");
        const { chatComplete } = await import("../lib/llm.js");

        const promptContext = currentNode.data?.systemPrompt || "Jawab pertanyaan pelanggan dengan ramah dan informatif.";
        const chunks = await retrieveChunks(tenantId, messageText, 4);
        const ragInfo = chunks.map((c) => c.content || c.title).join("\n---\n");

        const completion = await chatComplete([
          { role: "system", content: `${promptContext}\n\nRELEVAN KNOWLEDGE BASE:\n${ragInfo}` },
          { role: "user", content: messageText },
        ]);

        const aiText = completion.content || "Terima kasih telah menghubungi kami!";
        botReplies.push({ type: "text", text: aiText });

        // Check if any product photo matches
        const products = await prisma.product.findMany({
          where: { tenantId, imageUrl: { not: null } },
          take: 10,
        });
        const matched = products.find((p) => p.imageUrl && aiText.toLowerCase().includes(p.name.toLowerCase()));
        if (matched?.imageUrl) {
          botReplies.push({ type: "media", caption: `Foto Produk ${matched.name}`, mediaUrl: matched.imageUrl });
        }
      } else if (currentNode.type?.includes("handover")) {
        botReplies.push({ type: "handover", text: "Percakapan dialihkan ke Customer Service Manusia 🔔" });
        break;
      } else if (currentNode.type?.includes("action")) {
        botReplies.push({ type: "qris", text: currentNode.data?.label || "Tagihan QRIS B2 Midtrans Diterbitkan" });
      } else if (currentNode.type?.includes("webhook")) {
        botReplies.push({ type: "text", text: "🌐 Data survei/input berhasil dikirim ke Google Sheets." });
      }

      const outboundEdges = (edges || []).filter((e: any) => e.source === currentNode.id);
      if (outboundEdges.length === 0) break;

      if (currentNode.type?.includes("condition")) {
        const keywordsYes = (currentNode.data?.yesKeywords || "ya,beli,pesan,booking,setuju,ok,mau")
          .split(",")
          .map((k: string) => k.trim().toLowerCase());
        const isYes = keywordsYes.some((k: string) => incomingLower.includes(k));
        const targetHandle = isYes ? "yes" : "no";
        const matchedEdge = outboundEdges.find((e: any) => e.sourceHandle === targetHandle) || outboundEdges[0];
        currentNode = nodes.find((n) => n.id === matchedEdge.target);
      } else {
        currentNode = nodes.find((n) => n.id === outboundEdges[0].target);
      }
    }

    return { ok: true, executedNodeIds, replies: botReplies };
  });
}
