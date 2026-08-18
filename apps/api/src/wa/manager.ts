import fs from "node:fs";
import path from "node:path";
import { downloadMediaMessage } from "sanka-baileyss";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { hub } from "../ws/hub.js";
import { mapMessage, mapConversation } from "../lib/mappers.js";
import { transcribeAudio } from "../lib/transcribe.js";
import { analyzeImage } from "../lib/vision.js";
import { summarizeCall } from "../lib/call-summarizer.js";
import type { IWaDriver, WaSendMediaOptions } from "./types.js";
import { BaileysDriver } from "./drivers/baileys.driver.js";
import { OpenWaDriver } from "./drivers/openwa.driver.js";

type SessionRuntime = {
  driver: IWaDriver;
  tenantId: string;
  sessionId: string;
  engine: "baileys" | "openwa";
  qr?: string;
};

class WaManager {
  private activeDrivers = new Map<string, SessionRuntime>();

  get(sessionId: string) {
    const runtime = this.activeDrivers.get(sessionId);
    if (!runtime) return undefined;
    return {
      ...runtime,
      qr: runtime.driver.qr,
    };
  }

  listActive(tenantId: string) {
    return [...this.activeDrivers.values()].filter((s) => s.tenantId === tenantId);
  }

  /**
   * Driver Factory: Instantiates BaileysDriver or OpenWaDriver based on Prisma DB session engine.
   */
  private createDriver(
    engine: "baileys" | "openwa",
    tenantId: string,
    sessionId: string,
  ): IWaDriver {
    const handleInboundBound = (msg: any) =>
      this.handleInbound(tenantId, sessionId, msg);

    if (engine === "openwa") {
      return new OpenWaDriver(tenantId, sessionId, handleInboundBound);
    }
    return new BaileysDriver(tenantId, sessionId, handleInboundBound);
  }

  async resetAuth(sessionId: string) {
    const runtime = this.activeDrivers.get(sessionId);
    if (runtime) {
      await runtime.driver.resetAuth();
      this.activeDrivers.delete(sessionId);
    } else {
      const dbSession = await prisma.waSession.findUnique({
        where: { id: sessionId },
      });
      if (dbSession) {
        const driver = this.createDriver(
          dbSession.engine ?? "baileys",
          dbSession.tenantId,
          sessionId,
        );
        await driver.resetAuth();
      }
    }
  }

  async start(
    tenantId: string,
    sessionId: string,
    opts?: { forceQr?: boolean; engine?: "baileys" | "openwa" },
  ) {
    let runtime = this.activeDrivers.get(sessionId);

    // If engine selection changed or forceQr is set, stop previous driver
    if (runtime && (opts?.forceQr || (opts?.engine && opts.engine !== runtime.engine))) {
      await this.stop(sessionId, true);
      runtime = undefined;
    }

    if (!runtime) {
      const dbSession = await prisma.waSession.findUnique({
        where: { id: sessionId },
      });
      const engine = opts?.engine || dbSession?.engine || "baileys";

      // Save engine choice if changed
      if (dbSession && dbSession.engine !== engine) {
        await prisma.waSession.update({
          where: { id: sessionId },
          data: { engine },
        });
      }

      const driver = this.createDriver(engine, tenantId, sessionId);
      runtime = { driver, tenantId, sessionId, engine };
      this.activeDrivers.set(sessionId, runtime);
    }

    await runtime.driver.start(opts);
    return runtime;
  }

  async stop(sessionId: string, logout = false) {
    const runtime = this.activeDrivers.get(sessionId);
    if (runtime) {
      const res = await runtime.driver.stop(logout);
      this.activeDrivers.delete(sessionId);
      return res;
    }

    return prisma.waSession.update({
      where: { id: sessionId },
      data: {
        status: "disconnected",
        ...(logout ? { phoneE164: null } : {}),
      },
    });
  }

  async ensureDriver(sessionId: string): Promise<IWaDriver> {
    let runtime = this.activeDrivers.get(sessionId);
    if (!runtime) {
      const row = await prisma.waSession.findUnique({ where: { id: sessionId } });
      if (row && row.status !== "disconnected") {
        await this.start(row.tenantId, sessionId, { engine: row.engine });
        for (let i = 0; i < 20; i++) {
          runtime = this.activeDrivers.get(sessionId);
          if (runtime?.driver) break;
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    }
    runtime = this.activeDrivers.get(sessionId);
    if (!runtime?.driver) {
      throw new Error(
        "WhatsApp belum terhubung. Buka menu Channels → Hubungkan / scan QR, lalu coba lagi.",
      );
    }
    return runtime.driver;
  }

  async sendText(sessionId: string, jid: string, text: string) {
    const driver = await this.ensureDriver(sessionId);
    return driver.sendText(jid, text);
  }

  async sendImage(
    sessionId: string,
    jid: string,
    opts: string | { buffer: Buffer; caption?: string; mimetype?: string },
    captionText?: string,
  ) {
    const driver = await this.ensureDriver(sessionId);

    if (typeof opts === "string") {
      const imageUrl = opts;
      const caption = captionText;
      try {
        const res = await fetch(imageUrl);
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = res.headers.get("content-type") || "image/jpeg";

        return driver.sendMedia(jid, {
          buffer,
          caption,
          mimetype: contentType,
          fileName: "broadcast-image.jpg",
          isImage: true,
        });
      } catch (err) {
        console.warn(`[waManager] Failed to fetch image buffer from URL ${imageUrl}, falling back to text message`, err);
        const fallbackText = caption ? `${caption}\n\n🖼️ Brosur: ${imageUrl}` : imageUrl;
        return driver.sendText(jid, fallbackText);
      }
    }

    return driver.sendMedia(jid, {
      buffer: opts.buffer,
      caption: opts.caption,
      mimetype: opts.mimetype || "image/jpeg",
      fileName: "image.jpg",
      isImage: true,
    });
  }

  async sendDocument(
    sessionId: string,
    jid: string,
    opts: {
      buffer: Buffer;
      fileName: string;
      mimetype?: string;
      caption?: string;
    },
  ) {
    const driver = await this.ensureDriver(sessionId);
    return driver.sendMedia(jid, {
      buffer: opts.buffer,
      fileName: opts.fileName,
      mimetype: opts.mimetype || "application/octet-stream",
      caption: opts.caption,
      isImage: false,
    });
  }

  async sendMedia(
    sessionId: string,
    jid: string,
    opts: {
      buffer: Buffer;
      mimetype: string;
      fileName: string;
      caption?: string;
      isImage?: boolean;
      isVideo?: boolean;
    },
  ) {
    const driver = await this.ensureDriver(sessionId);
    return driver.sendMedia(jid, opts);
  }

  public async handleCallEvent(
    tenantId: string,
    sessionId: string,
    callData: {
      from: string;
      status: "offer" | "missed" | "reject" | "accept";
      id: string;
      durationSec?: number;
      audioBuffer?: Buffer;
      pushName?: string;
    },
  ) {
    if (!callData.from || callData.from.endsWith("@g.us")) return;
    const phone = callData.from.split("@")[0] ?? callData.from;
    const pushName = callData.pushName || `+${phone}`;
    const now = new Date();

    const contact = await prisma.contact.upsert({
      where: { tenantId_waJid: { tenantId, waJid: callData.from } },
      create: {
        tenantId,
        waJid: callData.from,
        phone: `+${phone.replace(/\D/g, "")}`,
        name: pushName,
        avatarHue: Math.floor(Math.random() * 360),
        lastMessageAt: now,
      },
      update: {
        name: pushName,
        lastMessageAt: now,
      },
    });

    let conversation = await prisma.conversation.findFirst({
      where: { tenantId, contactId: contact.id, waSessionId: sessionId, status: { not: "resolved" } },
      orderBy: { lastMessageAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId: contact.id,
          waSessionId: sessionId,
          status: "bot_active",
          mode: "bot",
          lastMessagePreview: "📞 Panggilan WhatsApp",
          lastMessageAt: now,
          unreadCount: 1,
        },
      });
    }

    const isMissed = callData.status === "missed" || callData.status === "reject";
    let summaryData = {
      summary: isMissed ? "Panggilan telepon tidak terangkat / ditolak." : "Panggilan telepon WhatsApp selesai.",
      keyTakeaways: isMissed ? [`Telepon dari pelanggan pada ${now.toLocaleTimeString()}`] : ["Percakapan via telepon selesai."],
      actionItems: isMissed ? ["Hubungi kembali nomor pelanggan"] : ["Tindak lanjuti hasil pembicaraan"],
      durationSec: callData.durationSec || 0,
      isMissedCall: isMissed,
    };

    if (!isMissed && callData.audioBuffer) {
      const transcript = await transcribeAudio(callData.audioBuffer, "call.ogg");
      if (transcript && !transcript.includes("(Pesan suara")) {
        const aiSummary = await summarizeCall(transcript);
        summaryData = {
          ...summaryData,
          summary: aiSummary.summary,
          keyTakeaways: aiSummary.keyTakeaways,
          actionItems: aiSummary.actionItems,
        };
      }
    }

    const waMessageId = `call_${callData.id}_${Date.now()}`;
    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        direction: "in",
        senderType: "customer",
        senderName: pushName,
        type: "call_summary" as any,
        body: `📞 Panggilan WhatsApp: ${summaryData.summary}`,
        waMessageId,
        metadata: {
          callSummary: summaryData,
        },
      },
    });

    const fullConv = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { contact: true, assignee: true },
    });

    hub.toTenant(tenantId, "message.created", mapMessage(message));
    if (fullConv) {
      hub.toTenant(tenantId, "conversation.updated", mapConversation(fullConv));
    }
    hub.toTenant(tenantId, "wa.call_incoming", {
      id: callData.id,
      from: callData.from,
      pushName,
      status: callData.status,
      timestamp: now.toISOString(),
    });

    if (callData.status === "offer") {
      try {
        const driver = await this.ensureDriver(sessionId);
        const greeting = `Halo Kak ${pushName}, terima kasih sudah menelpon! Saluran telepon kami saat ini sedang padat. Silakan tuliskan pertanyaan Kakak atau kirimkan Pesan Suara (Voice Note) di sini, AI kami siap membantu 24/7! 😊`;
        await driver.sendText(callData.from, greeting);

        const botMsg = await prisma.message.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            direction: "out",
            senderType: "bot",
            senderName: "AI Sales Bot",
            type: "text",
            body: greeting,
            waMessageId: `bot_greeting_${Date.now()}`,
          },
        });
        hub.toTenant(tenantId, "message.created", mapMessage(botMsg));
      } catch (sendErr) {
        console.warn("[waManager] Failed to send call auto-greeting:", sendErr);
      }
    }
  }

  async sendPresence(
    sessionId: string,
    jid: string,
    presence: "composing" | "recording" | "paused" | "available" = "composing",
  ) {
    try {
      const driver = await this.ensureDriver(sessionId);
      if (driver.sendPresence) {
        await driver.sendPresence(jid, presence);
      }
    } catch {
      /* ignore presence errors */
    }
  }

  async readMessage(sessionId: string, keys: any[]) {
    try {
      const driver = await this.ensureDriver(sessionId);
      if (driver.readMessage) {
        await driver.readMessage(keys);
      }
    } catch {
      /* ignore read receipt errors */
    }
  }

  public async handleInbound(
    tenantId: string,
    sessionId: string,
    msg: any,
  ) {
    const rawJid = msg.key?.remoteJid || msg.from || msg.chatId;
    const isFromMe = Boolean(msg.key?.fromMe || msg.fromMe);

    console.info(`[waManager] handleInbound called for tenant: ${tenantId}, jid: ${rawJid}, fromMe: ${isFromMe}`);
    if (!rawJid || rawJid.endsWith("@g.us") || rawJid === "status@broadcast" || rawJid.endsWith("@newsletter")) {
      console.info(`[waManager] Ignored JID: ${rawJid} (group, status, or newsletter)`);
      return;
    }

    // Extract real PN JID if this is an @lid message
    let jid = rawJid;
    const senderPn = msg.key?.participant_pn || msg.sender_pn || msg.participant_pn || msg.key?.remoteJidAlt;
    const pushName = (msg.pushName || msg.sender?.pushname || "").trim();

    if (jid.endsWith("@lid")) {
      if (senderPn && senderPn.endsWith("@s.whatsapp.net")) {
        jid = senderPn;
      } else if (pushName) {
        const matchByName = await prisma.contact.findFirst({
          where: { tenantId, name: pushName, waJid: { endsWith: "@s.whatsapp.net" } },
        });
        if (matchByName) {
          jid = matchByName.waJid;
        }
      }
    }

    // Unwrap viewOnce / document / edited message wrappers if present
    let rawMsgObj = msg.message;
    if (rawMsgObj?.viewOnceMessage?.message) {
      rawMsgObj = rawMsgObj.viewOnceMessage.message;
    } else if (rawMsgObj?.viewOnceMessageV2?.message) {
      rawMsgObj = rawMsgObj.viewOnceMessageV2.message;
    } else if (rawMsgObj?.viewOnceMessageV2Extension?.message) {
      rawMsgObj = rawMsgObj.viewOnceMessageV2Extension.message;
    } else if (rawMsgObj?.documentWithCaptionMessage?.message) {
      rawMsgObj = rawMsgObj.documentWithCaptionMessage.message;
    } else if (rawMsgObj?.editedMessage?.message?.protocolMessage?.editedMessage) {
      rawMsgObj = rawMsgObj.editedMessage.message.protocolMessage.editedMessage;
    }

    let body =
      rawMsgObj?.conversation ||
      rawMsgObj?.extendedTextMessage?.text ||
      rawMsgObj?.imageMessage?.caption ||
      rawMsgObj?.videoMessage?.caption ||
      rawMsgObj?.documentMessage?.caption ||
      msg.body ||
      msg.caption ||
      "";

    // Handle interactive responses, buttons, locations, contacts, stickers
    if (!body) {
      if (rawMsgObj?.buttonsResponseMessage) {
        body = rawMsgObj.buttonsResponseMessage.selectedDisplayText || rawMsgObj.buttonsResponseMessage.selectedButtonId || "";
      } else if (rawMsgObj?.listResponseMessage) {
        body = rawMsgObj.listResponseMessage.title || rawMsgObj.listResponseMessage.singleSelectReply?.selectedRowId || "";
      } else if (rawMsgObj?.templateButtonReplyMessage) {
        body = rawMsgObj.templateButtonReplyMessage.selectedDisplayText || rawMsgObj.templateButtonReplyMessage.selectedId || "";
      } else if (rawMsgObj?.interactiveResponseMessage?.nativeFlowResponseMessage) {
        body = rawMsgObj.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson || "";
      } else if (rawMsgObj?.locationMessage) {
        body = `[📍 Lokasi: ${rawMsgObj.locationMessage.name || rawMsgObj.locationMessage.comment || `${rawMsgObj.locationMessage.degreesLatitude}, ${rawMsgObj.locationMessage.degreesLongitude}`}]`;
      } else if (rawMsgObj?.contactMessage) {
        body = `[👤 Kontak: ${rawMsgObj.contactMessage.displayName || "Kartu Kontak"}]`;
      } else if (rawMsgObj?.contactsArrayMessage) {
        body = `[👤 ${rawMsgObj.contactsArrayMessage.contacts?.length || 1} Kartu Kontak]`;
      } else if (rawMsgObj?.stickerMessage) {
        body = "[Stiker]";
      }
    }

    const hasImage = Boolean(rawMsgObj?.imageMessage || msg.type === "image");
    const hasDoc = Boolean(rawMsgObj?.documentMessage || msg.type === "document");
    const hasAudio = Boolean(rawMsgObj?.audioMessage || msg.type === "audio" || msg.type === "ptt");
    const hasSticker = Boolean(rawMsgObj?.stickerMessage || msg.type === "sticker");

    if (!body && !hasImage && !hasDoc && !hasAudio && !hasSticker) {
      console.info("[waManager] Ignored message without text body/media:", JSON.stringify(msg.message));
      return;
    }

    console.info(`[waManager] Processing message from ${jid} (fromMe: ${isFromMe}): "${body}"`);

    const waMessageId = msg.key?.id || msg.id || `${Date.now()}`;
    const phone = jid.split("@")[0] ?? jid;
    const displayName = pushName || phone;
    const now = new Date();

    const existing = await prisma.message.findUnique({
      where: {
        tenantId_waMessageId: { tenantId, waMessageId },
      },
    });
    if (existing) return;

    let mediaMeta: {
      mediaUrl?: string;
      mimeType?: string;
      fileName?: string;
      transcript?: string;
      imageAnalysis?: string;
    } = {};
    let msgType: "text" | "image" | "document" | "audio" = "text";
    if (hasImage) msgType = "image";
    else if (hasDoc) msgType = "document";
    else if (hasAudio) msgType = "audio";

    let messageBody = body;
    let preview =
      body ||
      (msgType === "image" ? "[gambar]" : msgType === "document" ? "[dokumen]" : msgType === "audio" ? "[pesan suara]" : "[media]");

    // Download media buffer for audio (voice note), image, or document
    if (hasAudio || hasImage || hasDoc) {
      try {
        const mediaBuffer = await downloadMediaMessage(
          msg,
          "buffer",
          {},
        ).catch((err) => {
          console.warn("[waManager] Error downloading media from Baileys:", err);
          return null;
        });

        if (mediaBuffer && mediaBuffer.length > 0) {
          const ext = hasAudio ? "ogg" : hasImage ? "jpg" : "bin";
          const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const uploadDir = path.resolve(env.STORAGE_LOCAL_PATH || "./uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const filePath = path.join(uploadDir, filename);
          fs.writeFileSync(filePath, mediaBuffer);

          const mimeType = hasAudio ? "audio/ogg" : hasImage ? "image/jpeg" : "application/octet-stream";
          mediaMeta = {
            mediaUrl: `/api/v1/media/${filename}`,
            mimeType,
            fileName: filename,
          };

          if (hasAudio) {
            console.info("[waManager] Transcribing audio voice note via Whisper API...");
            const transcript = await transcribeAudio(mediaBuffer, filename);
            console.info("[waManager] Transcribed Voice Note Result:", transcript);
            mediaMeta.transcript = transcript;
            messageBody = transcript;
            preview = `🎙️ ${transcript}`;
          } else if (hasImage) {
            console.info("[waManager] Analyzing image via Vision AI...");
            const imageAnalysis = await analyzeImage(mediaBuffer, mimeType);
            console.info("[waManager] Image Analysis Result:", imageAnalysis);
            mediaMeta.imageAnalysis = imageAnalysis;
            const caption = (msg.message?.imageMessage?.caption || msg.caption || "").trim();
            messageBody = caption ? `${caption}\n[Analisis Visual AI: ${imageAnalysis}]` : `[Foto Dikirim Pelanggan - Analisis Visual AI: ${imageAnalysis}]`;
            preview = `📷 ${imageAnalysis.slice(0, 100)}`;
          }
        }
      } catch (mediaErr) {
        console.warn("[waManager] Media download process failed:", mediaErr);
      }
    }

    // Deduplicate contact: search by waJid or name
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [
          { waJid: jid },
          ...(pushName ? [{ name: pushName, waJid: { endsWith: "@s.whatsapp.net" } }] : []),
        ],
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          waJid: jid,
          phone: `+${phone.replace(/\D/g, "")}`,
          name: displayName,
          avatarHue: Math.floor(Math.random() * 360),
          lastMessageAt: now,
        },
      });
    } else {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          name: displayName || contact.name,
          lastMessageAt: now,
        },
      });
    }

    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId: contact.id,
      },
      orderBy: { lastMessageAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId: contact.id,
          waSessionId: sessionId,
          channel: "whatsapp",
          status: "bot_active",
          mode: "bot",
          lastMessagePreview: isFromMe ? `Anda: ${preview}` : preview,
          lastMessageAt: now,
          unreadCount: isFromMe ? 0 : 1,
        },
      });
    } else {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          waSessionId: sessionId || conversation.waSessionId,
          status: isFromMe ? conversation.status : (conversation.status === "resolved" ? "bot_active" : conversation.status),
          mode: isFromMe ? conversation.mode : (conversation.status === "resolved" ? "bot" : conversation.mode),
          lastMessagePreview: isFromMe ? `Anda: ${preview}` : preview,
          lastMessageAt: now,
          ...(isFromMe ? {} : { unreadCount: { increment: 1 } }),
          ...(!isFromMe && conversation.followupStageCount > 0 && !conversation.followupConvertedAt
            ? {
                followupConvertedAt: now,
                followupConvertedStage: conversation.followupStageCount,
              }
            : {}),
        },
      });
    }

    let message;
    try {
      message = await prisma.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: isFromMe ? "out" : "in",
          senderType: isFromMe ? "agent" : "customer",
          senderName: isFromMe ? "Saya" : pushName,
          type: msgType,
          body: messageBody || preview,
          waMessageId,
          metadata: mediaMeta,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        console.info(`[waManager] Duplicate waMessageId ${waMessageId} ignored cleanly`);
        return;
      }
      throw err;
    }

    const full = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: { contact: true, assignee: true },
    });

    hub.toTenant(tenantId, "message.created", mapMessage(message));
    hub.toTenant(tenantId, "conversation.updated", mapConversation(full));

    // If message is fromMe, do NOT trigger AI Bot reply
    if (isFromMe) return;

    const effectiveTriggerText = (messageBody || mediaMeta?.imageAnalysis || mediaMeta?.transcript || "").trim();
    if (!effectiveTriggerText) return;

    const settings = await prisma.botSettings.findUnique({
      where: { tenantId },
    });
    const botOn = settings?.enabled !== false;
    if (botOn && full.status !== "resolved") {
      if (full.mode !== "bot" || full.status === "waiting_agent" || full.status === "assigned") {
        const reset = await prisma.conversation.update({
          where: { id: full.id },
          data: { mode: "bot", status: "bot_active" },
          include: { contact: true, assignee: true },
        });
        hub.toTenant(tenantId, "conversation.updated", mapConversation(reset));
      }
      const { scheduleBotReply } = await import("../bot/reply.js");
      scheduleBotReply(full.id);
    }
  }
}

export const waManager = new WaManager();
