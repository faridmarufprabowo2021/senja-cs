import { prisma } from "../../lib/prisma.js";
import { hub } from "../../ws/hub.js";
import { mapWaSession } from "../../lib/mappers.js";
import type { IWaDriver, WaSendMediaOptions } from "../types.js";

const OPENWA_SERVER_URL = process.env.OPENWA_SERVER_URL || "http://localhost:8008";
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || "senja_cs_openwa_secret";

export class OpenWaDriver implements IWaDriver {
  public qr?: string;
  private isConnected = false;

  constructor(
    private tenantId: string,
    private sessionId: string,
    private handleInbound: (msg: any) => Promise<void>,
  ) {}

  private async request(path: string, options: RequestInit = {}) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENWA_API_KEY}`,
      ...options.headers,
    };
    const res = await fetch(`${OPENWA_SERVER_URL}${path}`, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`[openwa] API error (${res.status}): ${errText}`);
    }
    return res.json();
  }

  async start(opts?: { forceQr?: boolean }) {
    if (opts?.forceQr) {
      await this.resetAuth();
    }

    await prisma.waSession.update({
      where: { id: this.sessionId },
      data: { status: "pending", errorCode: null },
    });

    try {
      let qrDataUrl: string | undefined;

      // STEP 1: Create or initialize session via /sessions/{id}/start API FIRST
      // This is required - QR endpoint only works AFTER session is created
      const sessionData = await this.request(`/sessions/${this.sessionId}/start`, {
        method: "POST",
        body: JSON.stringify({
          webhook: `${process.env.WEB_URL || "http://localhost:4000"}/api/wa/openwa-webhook`,
        }),
      });

      if (sessionData?.qr) {
        // QR returned immediately from start call
        qrDataUrl = sessionData.qr;
        this.qr = qrDataUrl;
        const session = await prisma.waSession.update({
          where: { id: this.sessionId },
          data: { status: "qr" },
        });
        hub.toTenant(this.tenantId, "wa.qr", {
          sessionId: this.sessionId,
          qr: qrDataUrl,
          session: mapWaSession(session),
        });
        hub.toTenant(this.tenantId, "wa.status", {
          sessionId: this.sessionId,
          status: "qr",
        });
        return;
      } else if (sessionData?.connected) {
        // Already connected
        this.qr = undefined;
        this.isConnected = true;
        const session = await prisma.waSession.update({
          where: { id: this.sessionId },
          data: {
            status: "connected",
            phoneE164: sessionData.phone ? `+${sessionData.phone}` : null,
            lastSeenAt: new Date(),
            errorCode: null,
          },
        });
        hub.toTenant(this.tenantId, "wa.status", {
          sessionId: this.sessionId,
          status: "connected",
          session: mapWaSession(session),
        });
        return;
      }

      // STEP 2: Poll for QR every 1 second until we get it or timeout
      const maxAttempts = 30; // 30 seconds max
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));

        try {
          const qrRes = await fetch(`${OPENWA_SERVER_URL}/qr`, {
            headers: { Authorization: `Bearer ${OPENWA_API_KEY}` },
          });
          
          if (qrRes.ok) {
            const contentType = qrRes.headers.get("content-type") || "";
            if (contentType.includes("image") || contentType.includes("png")) {
              const arrayBuffer = await qrRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString("base64");
              qrDataUrl = `data:image/png;base64,${base64}`;
              
              if (qrDataUrl) {
                this.qr = qrDataUrl;
                const session = await prisma.waSession.update({
                  where: { id: this.sessionId },
                  data: { status: "qr" },
                });
                hub.toTenant(this.tenantId, "wa.qr", {
                  sessionId: this.sessionId,
                  qr: qrDataUrl,
                  session: mapWaSession(session),
                });
                hub.toTenant(this.tenantId, "wa.status", {
                  sessionId: this.sessionId,
                  status: "qr",
                });
                return;
              }
            }
          }
        } catch (e) {
          console.warn(`[wa-openwa] poll attempt ${attempt} failed:`, e);
        }
      }

      // STEP 3: If still no QR after polling, check direct endpoint one more time
      try {
        const qrRes = await fetch(`${OPENWA_SERVER_URL}/qr`, {
          headers: { Authorization: `Bearer ${OPENWA_API_KEY}` },
        });
        if (qrRes.ok && qrRes.headers.get("content-type")?.includes("image")) {
          const arrayBuffer = await qrRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          qrDataUrl = `data:image/png;base64,${base64}`;
          
          if (qrDataUrl) {
            this.qr = qrDataUrl;
            const session = await prisma.waSession.update({
              where: { id: this.sessionId },
              data: { status: "qr" },
            });
            hub.toTenant(this.tenantId, "wa.qr", {
              sessionId: this.sessionId,
              qr: qrDataUrl,
              session: mapWaSession(session),
            });
            hub.toTenant(this.tenantId, "wa.status", {
              sessionId: this.sessionId,
              status: "qr",
            });
          }
        }
      } catch (e) {
        console.warn("[wa-openwa] final QR fetch error:", e);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "unknown";
      console.error(`[wa-openwa] start FAILED for ${this.sessionId}:`, errorMsg);
      
      // Provide helpful diagnostic message
      const detailedError = 
        errorMsg.includes("fetch failed") ||
        errorMsg.includes("ECONNREFUSED") ||
        errorMsg.includes("ENOTFOUND")
        ? "Server Open-WA tidak merespons. Pastikan Docker container berjalan: docker ps | grep openwa"
        : errorMsg;
        
      await prisma.waSession.update({
        where: { id: this.sessionId },
        data: {
          status: "disconnected",
          errorCode: detailedError,
        },
      });
    }
  }

  async getQr(): Promise<string | null> {
    if (this.qr) return this.qr;
    
    // Try direct fetch first
    try {
      const qrRes = await fetch(`${OPENWA_SERVER_URL}/qr`, {
        headers: { Authorization: `Bearer ${OPENWA_API_KEY}` },
      });
      if (qrRes.ok && qrRes.headers.get("content-type")?.includes("image")) {
        const arrayBuffer = await qrRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        this.qr = `data:image/png;base64,${base64}`;
        return this.qr;
      }
    } catch (e) {
      console.warn("[wa-openwa] getQr fetch error:", e);
    }
    
    // Fallback: try polling like in start()
    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      
      try {
        const qrRes = await fetch(`${OPENWA_SERVER_URL}/qr`, {
          headers: { Authorization: `Bearer ${OPENWA_API_KEY}` },
        });
        if (qrRes.ok && qrRes.headers.get("content-type")?.includes("image")) {
          const arrayBuffer = await qrRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          this.qr = `data:image/png;base64,${base64}`;
          return this.qr;
        }
      } catch (e) {
        // continue polling
      }
    }
    
    return null;
  }

  async resetAuth() {
    this.isConnected = false;
    try {
      await this.request(`/sessions/${this.sessionId}/reset`, { method: "POST" });
    } catch {
      /* ignore if daemon down */
    }
    await prisma.waSession.update({
      where: { id: this.sessionId },
      data: {
        status: "disconnected",
        phoneE164: null,
        errorCode: null,
      },
    });
  }

  async stop(logout = false) {
    this.isConnected = false;
    try {
      await this.request(`/sessions/${this.sessionId}/${logout ? "logout" : "stop"}`, {
        method: "POST",
      });
    } catch {
      /* ignore */
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
    return this.request(`/sessions/${this.sessionId}/send-message`, {
      method: "POST",
      body: JSON.stringify({ to: jid, content: text }),
    });
  }

  async sendMedia(jid: string, opts: WaSendMediaOptions) {
    const base64 = opts.buffer.toString("base64");
    const dataUrl = `data:${opts.mimetype};base64,${base64}`;
    return this.request(`/sessions/${this.sessionId}/send-file`, {
      method: "POST",
      body: JSON.stringify({
        to: jid,
        file: dataUrl,
        filename: opts.fileName,
        caption: opts.caption || "",
      }),
    });
  }
}
