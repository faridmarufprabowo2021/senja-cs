import { Boom } from "@hapi/boom";
import * as baileys from "sanka-baileyss";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import { hub } from "../../ws/hub.js";
import { mapWaSession } from "../../lib/mappers.js";
import type { IWaDriver, WaSendMediaOptions } from "../types.js";

// sanka-baileyss resolution
const b: any = baileys;
const makeWASocket = b.makeWASocket || b.default;
const DisconnectReason = b.DisconnectReason || b.default?.DisconnectReason;
const fetchLatestBaileysVersion = b.fetchLatestBaileysVersion || b.default?.fetchLatestBaileysVersion;
const useMultiFileAuthState = b.useMultiFileAuthState || b.default?.useMultiFileAuthState;

export class BaileysDriver implements IWaDriver {
  public qr?: string;
  private socket: any = null;
  private suppressReconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private rawMessageCache = new Map<string, any>();

  constructor(
    private tenantId: string,
    private sessionId: string,
    private handleInbound: (msg: any) => Promise<void>,
  ) {}

  private authDir() {
    const dir = path.join(env.WA_AUTH_DIR, this.sessionId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.suppressReconnect) return;
    this.clearReconnect();
    this.reconnectAttempt += 1;
    if (this.reconnectAttempt > 8) {
      console.warn("[wa-baileys] give up reconnect", this.sessionId);
      return;
    }
    const delay = Math.min(30_000, 2000 * 2 ** (this.reconnectAttempt - 1));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.suppressReconnect) return;
      void this.start().catch((err) => {
        console.warn("[wa-baileys] reconnect failed", this.sessionId, err);
      });
    }, delay);
  }

  async resetAuth() {
    this.suppressReconnect = true;
    this.clearReconnect();
    this.reconnectAttempt = 0;
    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    const dir = this.authDir();
    fs.rmSync(dir, { recursive: true, force: true });
    await prisma.waSession.update({
      where: { id: this.sessionId },
      data: {
        status: "disconnected",
        phoneE164: null,
        errorCode: null,
      },
    });
  }

  async start(opts?: { forceQr?: boolean }) {
    if (opts?.forceQr) {
      await this.resetAuth();
    }

    this.suppressReconnect = false;
    this.clearReconnect();

    await prisma.waSession.update({
      where: { id: this.sessionId },
      data: { status: "pending", errorCode: null },
    });

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir());
    const { version } = await fetchLatestBaileysVersion().catch((err: any) => {
      console.warn("[wa-baileys] fetchLatestBaileysVersion failed, using fallback version:", err);
      return { version: [2, 3000, 1015901307] as [number, number, number] };
    });

    this.socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      retryRequestDelayMs: 500,
      maxMsgRetryCount: 5,
      browser: ["Ubuntu", "Chrome", "22.04.4"],
      getMessage: async (key: any) => {
        if (!key?.id) return undefined;
        // 1. Check in-memory LRU cache first
        const cached = this.rawMessageCache.get(key.id);
        if (cached) return cached;

        // 2. Fallback: Lookup rawProto from PostgreSQL DB
        try {
          const dbMsg = await prisma.message.findFirst({
            where: {
              waMessageId: key.id,
            },
          });
          if (dbMsg?.rawProto) {
            const parsed = JSON.parse(dbMsg.rawProto);
            this.rawMessageCache.set(key.id, parsed);
            return parsed;
          }
          if (dbMsg?.body) {
            return {
              conversation: dbMsg.body,
              extendedTextMessage: {
                text: dbMsg.body,
              },
            };
          }
        } catch (err) {
          console.warn("[wa-baileys] getMessage retry lookup error:", err);
        }
        return undefined;
      },
    });

    this.socket.ev.on("creds.update", saveCreds);

    this.socket.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qr = qr;
        const session = await prisma.waSession.update({
          where: { id: this.sessionId },
          data: { status: "qr" },
        });
        hub.toTenant(this.tenantId, "wa.qr", {
          sessionId: this.sessionId,
          qr,
          session: mapWaSession(session),
        });
        hub.toTenant(this.tenantId, "wa.status", {
          sessionId: this.sessionId,
          status: "qr",
        });
      }

      if (connection === "open") {
        this.qr = undefined;
        this.reconnectAttempt = 0;
        this.clearReconnect();
        
        // Asynchronously replenish E2EE prekeys on WhatsApp servers
        try {
          await this.socket?.uploadPreKeys(50);
        } catch (err) {
          console.warn("[wa-baileys] uploadPreKeys non-fatal error:", err);
        }

        const phone =
          this.socket.user?.id?.split(":")[0]?.replace(/\D/g, "") ?? null;
        const session = await prisma.waSession.update({
          where: { id: this.sessionId },
          data: {
            status: "connected",
            phoneE164: phone ? `+${phone}` : null,
            lastSeenAt: new Date(),
            errorCode: null,
          },
        });
        hub.toTenant(this.tenantId, "wa.status", {
          sessionId: this.sessionId,
          status: "connected",
          session: mapWaSession(session),
        });
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as Boom | undefined)?.output
          ?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut || code === 401 || code === 403;
        this.socket = null;

        if (loggedOut) {
          console.warn("[wa-baileys] Session logged out or auth invalid, resetting auth keys:", this.sessionId);
          await this.resetAuth().catch(() => null);
        } else {
          const session = await prisma.waSession.update({
            where: { id: this.sessionId },
            data: {
              status: "disconnected",
              errorCode: code ? String(code) : "close",
            },
          });
          hub.toTenant(this.tenantId, "wa.status", {
            sessionId: this.sessionId,
            status: "disconnected",
            session: mapWaSession(session),
          });
        }

        if (!loggedOut && !this.suppressReconnect) {
          this.scheduleReconnect();
        }
      }
    });

    this.socket.ev.on("messages.upsert", async (payload: any) => {
      const messages = payload?.messages ?? [];
      const type = payload?.type;
      console.info("[wa-baileys] messages.upsert received, type:", type, "count:", messages.length);
      for (const msg of messages) {
        console.info("[wa-baileys] message item key:", JSON.stringify(msg.key), "pushName:", msg.pushName);
        await this.handleInbound(msg).catch((err) => {
          console.error("[wa-baileys] inbound error", err);
        });
      }
    });

    this.socket.ev.on("call", async (calls: any[]) => {
      for (const call of calls) {
        try {
          const { waManager } = await import("../manager.js");
          await waManager.handleCallEvent(this.tenantId, this.sessionId, {
            id: call.id,
            from: call.from,
            status: call.status,
            durationSec: call.duration,
          });
          if (call.status === "offer" && this.socket) {
            await this.socket.rejectCall(call.id, call.from).catch(() => null);
          }
        } catch (callErr) {
          console.warn("[wa-baileys] call event error:", callErr);
        }
      }
    });
  }

  async stop(logout = false) {
    this.suppressReconnect = true;
    this.clearReconnect();
    this.reconnectAttempt = 0;

    if (this.socket) {
      try {
        if (logout) await this.socket.logout();
        else this.socket.end(undefined);
      } catch {
        /* ignore */
      }
      this.socket = null;
    }

    if (logout) {
      const dir = this.authDir();
      fs.rmSync(dir, { recursive: true, force: true });
    }

    return prisma.waSession.update({
      where: { id: this.sessionId },
      data: {
        status: "disconnected",
        ...(logout ? { phoneE164: null } : {}),
      },
    });
  }

  private async resolvePhoneJid(jid: string): Promise<string> {
    if (!jid) return jid;
    if (jid.endsWith("@s.whatsapp.net")) return jid;
    if (jid.endsWith("@g.us")) return jid;

    if (jid.endsWith("@lid")) {
      const contact = await prisma.contact.findFirst({
        where: {
          tenantId: this.tenantId,
          waJid: jid,
        },
      });
      if (contact?.phone) {
        const cleaned = contact.phone.replace(/\D/g, "");
        if (cleaned.length >= 7) {
          const phoneJid = `${cleaned}@s.whatsapp.net`;
          await prisma.contact.update({
            where: { id: contact.id },
            data: { waJid: phoneJid },
          }).catch(() => null);
          return phoneJid;
        }
      }
    }
    return jid;
  }

  async sendText(jid: string, text: string) {
    if (!this.socket) {
      throw new Error(
        "WhatsApp (Baileys) belum terhubung. Buka menu Channels → Hubungkan / scan QR, lalu coba lagi.",
      );
    }
    const targetJid = await this.resolvePhoneJid(jid);
    const sent = await this.socket.sendMessage(targetJid, { text });

    if (sent?.key?.id && sent?.message) {
      this.rawMessageCache.set(sent.key.id, sent.message);
      if (this.rawMessageCache.size > 1000) {
        const firstKey = this.rawMessageCache.keys().next().value;
        if (firstKey) this.rawMessageCache.delete(firstKey);
      }
    }

    return {
      ...sent,
      rawProto: sent?.message ? JSON.stringify(sent.message) : undefined,
    };
  }

  async sendMedia(jid: string, opts: WaSendMediaOptions) {
    if (!this.socket) {
      throw new Error(
        "WhatsApp (Baileys) belum terhubung. Buka menu Channels → Hubungkan / scan QR, lalu coba lagi.",
      );
    }
    const targetJid = await this.resolvePhoneJid(jid);
    let sent: any;
    if (opts.isVideo) {
      sent = await this.socket.sendMessage(targetJid, {
        video: opts.buffer,
        caption: opts.caption,
        mimetype: opts.mimetype || "video/mp4",
      });
    } else if (opts.isImage) {
      sent = await this.socket.sendMessage(targetJid, {
        image: opts.buffer,
        caption: opts.caption,
        mimetype: opts.mimetype || "image/jpeg",
      });
    } else {
      sent = await this.socket.sendMessage(targetJid, {
        document: opts.buffer,
        fileName: opts.fileName,
        mimetype: opts.mimetype || "application/octet-stream",
        caption: opts.caption,
      });
    }

    if (sent?.key?.id && sent?.message) {
      this.rawMessageCache.set(sent.key.id, sent.message);
      if (this.rawMessageCache.size > 1000) {
        const firstKey = this.rawMessageCache.keys().next().value;
        if (firstKey) this.rawMessageCache.delete(firstKey);
      }
    }

    return {
      ...sent,
      rawProto: sent?.message ? JSON.stringify(sent.message) : undefined,
    };
  }

  async sendPresence(jid: string, presence: "composing" | "recording" | "paused" | "available" = "composing") {
    if (!this.socket) return;
    try {
      await this.socket.sendPresenceUpdate(presence, jid);
    } catch {
      /* ignore presence errors */
    }
  }

  async readMessage(keys: any[]) {
    if (!this.socket || !keys?.length) return;
    try {
      await this.socket.readMessages(keys);
    } catch {
      /* ignore read receipt errors */
    }
  }
}
