import { Boom } from "@hapi/boom";
import baileys from "sanka-baileyss";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import { hub } from "../../ws/hub.js";
import { mapWaSession } from "../../lib/mappers.js";
import type { IWaDriver, WaSendMediaOptions } from "../types.js";

// sanka-baileyss CJS ESM fallback
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baileysMod: any =
  (baileys as any)?.makeWASocket || (baileys as any)?.useMultiFileAuthState
    ? baileys
    : (baileys as any)?.default ?? baileys;

const makeWASocket: (...args: any[]) => any =
  typeof baileysMod === "function"
    ? baileysMod
    : baileysMod.makeWASocket ?? baileysMod.default;

const DisconnectReason = baileysMod.DisconnectReason;
const fetchLatestBaileysVersion = baileysMod.fetchLatestBaileysVersion as () => Promise<{
  version: [number, number, number];
}>;
const useMultiFileAuthState = baileysMod.useMultiFileAuthState as (
  folder: string,
) => Promise<{ state: any; saveCreds: () => Promise<void> }>;

export class BaileysDriver implements IWaDriver {
  public qr?: string;
  private socket: any = null;
  private suppressReconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
    const { version } = await fetchLatestBaileysVersion();

    this.socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
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
        const loggedOut = code === DisconnectReason.loggedOut;
        this.socket = null;

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

        if (!loggedOut && !this.suppressReconnect) {
          this.scheduleReconnect();
        }
      }
    });

    this.socket.ev.on("messages.upsert", async (payload: any) => {
      const messages = payload?.messages ?? [];
      const type = payload?.type;
      if (type !== "notify") return;
      for (const msg of messages) {
        await this.handleInbound(msg).catch((err) => {
          console.error("[wa-baileys] inbound error", err);
        });
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

  async sendText(jid: string, text: string) {
    if (!this.socket) {
      throw new Error(
        "WhatsApp (Baileys) belum terhubung. Buka menu Channels → Hubungkan / scan QR, lalu coba lagi.",
      );
    }
    return this.socket.sendMessage(jid, { text });
  }

  async sendMedia(jid: string, opts: WaSendMediaOptions) {
    if (!this.socket) {
      throw new Error(
        "WhatsApp (Baileys) belum terhubung. Buka menu Channels → Hubungkan / scan QR, lalu coba lagi.",
      );
    }
    if (opts.isImage) {
      return this.socket.sendMessage(jid, {
        image: opts.buffer,
        caption: opts.caption,
        mimetype: opts.mimetype || "image/jpeg",
      });
    }
    return this.socket.sendMessage(jid, {
      document: opts.buffer,
      fileName: opts.fileName,
      mimetype: opts.mimetype || "application/octet-stream",
      caption: opts.caption,
    });
  }
}
