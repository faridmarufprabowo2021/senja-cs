import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant } from "../lib/auth.js";
import { hub } from "../ws/hub.js";
import { mapMessage, mapConversation } from "../lib/mappers.js";
import {
  sendInstagramMessage,
  sendInstagramPrivateReply,
  sendInstagramPublicCommentReply,
} from "../channels/instagram.driver.js";

const updateConfigSchema = z.object({
  igAccessToken: z.string().min(1),
  igPageId: z.string().optional(),
  igUserId: z.string().optional(),
  igConnected: z.boolean().default(true),
});

const commentRuleSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
  targetPostId: z.string().optional(),
  keywords: z.string().min(1),
  publicReplyText: z.string().optional(),
  privateReplyText: z.string().min(1),
  flowId: z.string().optional(),
});

export async function instagramRoutes(app: FastifyInstance) {
  // OAuth URL helper endpoint: GET /api/v1/channels/instagram/oauth/url
  app.get("/channels/instagram/oauth/url", async (request) => {
    const appId = process.env.META_APP_ID || "1234567890";
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
    const redirectUri = `${apiBaseUrl}/api/v1/channels/instagram/oauth/callback`;
    const scopes = ["business_management"].join(",");

    const state = request.headers.authorization || "";

    const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(
      appId,
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(
      scopes,
    )}&response_type=code&state=${encodeURIComponent(state)}`;

    return { ok: true, oauthUrl };
  });

  // OAuth Callback: GET /api/v1/channels/instagram/oauth/callback?code=...
  app.get("/channels/instagram/oauth/callback", async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    const webBaseUrl = process.env.WEB_BASE_URL || "http://localhost:3001";

    if (!code) {
      return reply.redirect(`${webBaseUrl}/settings/channels?error=NoCode`);
    }

    const appId = process.env.META_APP_ID || "";
    const appSecret = process.env.META_APP_SECRET || "";
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
    const redirectUri = `${apiBaseUrl}/api/v1/channels/instagram/oauth/callback`;

    try {
      // Exchange short-lived code for Long-Lived Token
      const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&client_secret=${appSecret}&code=${code}`;

      const res = await fetch(tokenUrl);
      const tokenData = (await res.json()) as any;

      if (tokenData.error || !tokenData.access_token) {
        return reply.redirect(
          `${webBaseUrl}/settings/channels?error=${encodeURIComponent(
            tokenData.error?.message || "TokenExchangeFailed",
          )}`,
        );
      }

      const userAccessToken = tokenData.access_token;

      // Fetch User's Accounts & Connected Instagram Business Accounts
      const accountsRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`,
      );
      const accountsData = (await accountsRes.json()) as any;
      const firstPage = accountsData.data?.[0];

      const pageAccessToken = firstPage?.access_token || userAccessToken;
      const pageId = firstPage?.id || null;
      const igUserId = firstPage?.instagram_business_account?.id || null;

      // Determine Tenant ID from JWT state token if provided
      let tenantId: string | null = null;
      if (state && state.startsWith("Bearer ")) {
        try {
          const jwt = state.replace("Bearer ", "");
          const decoded = app.jwt.verify<{ tenantId?: string }>(jwt);
          tenantId = decoded.tenantId || null;
        } catch {}
      }

      // Update all tenants or current tenant with Connected status & Token
      await prisma.tenant.updateMany({
        data: {
          igAccessToken: pageAccessToken,
          igPageId: pageId,
          igUserId,
          igConnected: true,
        },
      });

      return reply.redirect(`${webBaseUrl}/settings/channels?success=true`);
    } catch (err) {
      return reply.redirect(`${webBaseUrl}/settings/channels?error=OAuthError`);
    }
  });
  // 1. GET /api/v1/channels/instagram/webhook - Meta Webhook Challenge Verification
  app.get("/channels/instagram/webhook", async (request, reply) => {
    const query = request.query as any;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "senja_cs_meta_verify_token";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      request.log.info("Instagram Webhook verified successfully");
      return reply.code(200).send(challenge);
    }

    return reply.code(403).send({ error: "Forbidden: Verification token mismatch" });
  });

  // 2. POST /api/v1/channels/instagram/webhook - Inbound Instagram Messaging & Comment Receiver
  app.post("/channels/instagram/webhook", async (request, reply) => {
    const body = request.body as any;

    if (body.object !== "instagram" && body.object !== "page") {
      return { ok: true, ignored: true };
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      const messaging = entry.messaging || [];

      // A. Process Instagram Post/Reels Comments (Comment-to-DM Auto-Responder)
      for (const change of changes) {
        if (change.field === "comments" || change.field === "comment") {
          const val = change.value || {};
          const commentId = val.id;
          const commentText = val.text || "";
          const fromId = val.from?.id;
          const fromUsername = val.from?.username || "Pengguna Instagram";

          if (!commentId || !fromId || !commentText) continue;

          // Find tenant for this Instagram account
          const tenant = await prisma.tenant.findFirst({
            where: {
              OR: [
                { igUserId: entry.id },
                { igPageId: entry.id },
                { igConnected: true },
              ],
            },
          });

          if (!tenant || !tenant.igAccessToken) continue;

          // Find matching InstagramCommentRule for this tenant
          const activeRules = await prisma.instagramCommentRule.findMany({
            where: { tenantId: tenant.id, active: true },
          });

          const commentLower = commentText.toLowerCase().trim();

          const matchedRule = activeRules.find((rule) => {
            if (
              rule.targetPostId &&
              rule.targetPostId !== val.media?.id &&
              rule.targetPostId !== val.media?.code &&
              rule.targetPostId !== val.post_id
            ) {
              return false;
            }
            if (rule.keywords === "*" || rule.keywords.toLowerCase() === "all") return true;
            const kwList = rule.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
            return kwList.some((kw) => commentLower.includes(kw));
          });

          if (matchedRule) {
            // 1. Send Public Comment Reply (if configured)
            if (matchedRule.publicReplyText) {
              const publicText = matchedRule.publicReplyText.replace(/\{username\}/g, fromUsername);
              void sendInstagramPublicCommentReply({
                commentId,
                text: publicText,
                accessToken: tenant.igAccessToken,
              });
            }

            // 2. Send Private DM Reply (Comment-to-DM)
            const privateText = matchedRule.privateReplyText.replace(/\{username\}/g, fromUsername);
            await sendInstagramPrivateReply({
              commentId,
              text: privateText,
              accessToken: tenant.igAccessToken,
            });

            // 3. Upsert Contact & Conversation in DB for Unified Inbox UI
            const contact = await prisma.contact.upsert({
              where: {
                tenantId_waJid: { tenantId: tenant.id, waJid: `ig_${fromId}` },
              },
              create: {
                tenantId: tenant.id,
                waJid: `ig_${fromId}`,
                phone: `IG:${fromId}`,
                name: `@${fromUsername}`,
                avatarHue: 320,
                lastMessageAt: new Date(),
              },
              update: {
                name: `@${fromUsername}`,
                lastMessageAt: new Date(),
              },
            });

            const conversation = await prisma.conversation.create({
              data: {
                tenantId: tenant.id,
                contactId: contact.id,
                channel: "instagram",
                status: "bot_active",
                mode: "bot",
                lastMessagePreview: `[Auto-DM Reels] ${privateText}`,
                lastMessageAt: new Date(),
              },
            });

            const botMessage = await prisma.message.create({
              data: {
                tenantId: tenant.id,
                conversationId: conversation.id,
                channel: "instagram",
                direction: "out",
                senderType: "bot",
                senderName: "Senja IG Auto-DM",
                type: "text",
                body: privateText,
              },
            });

            const full = await prisma.conversation.findUniqueOrThrow({
              where: { id: conversation.id },
              include: { contact: true, assignee: true },
            });

            hub.toTenant(tenant.id, "message.created", mapMessage(botMessage));
            hub.toTenant(tenant.id, "conversation.updated", mapConversation(full));
          }
        }
      }

      // B. Process Inbound Instagram Direct Messages
      for (const event of messaging) {
        const senderId = event.sender?.id;
        const recipientId = event.recipient?.id;
        const messageText = event.message?.text || event.value?.message || "";
        const mid = event.message?.mid || `ig_${Date.now()}`;

        if (!senderId || !messageText) continue;

        const tenant = await prisma.tenant.findFirst({
          where: {
            OR: [
              { igUserId: recipientId },
              { igPageId: recipientId },
              { igConnected: true },
            ],
          },
        });

        if (!tenant) continue;
        const tenantId = tenant.id;

        const contact = await prisma.contact.upsert({
          where: {
            tenantId_waJid: { tenantId, waJid: `ig_${senderId}` },
          },
          create: {
            tenantId,
            waJid: `ig_${senderId}`,
            phone: `IG:${senderId}`,
            name: `IG User (${senderId.slice(-4)})`,
            avatarHue: 320,
            lastMessageAt: new Date(),
          },
          update: {
            lastMessageAt: new Date(),
          },
        });

        let conversation = await prisma.conversation.findFirst({
          where: {
            tenantId,
            contactId: contact.id,
            channel: "instagram",
            status: { not: "resolved" },
          },
          orderBy: { lastMessageAt: "desc" },
        });

        const now = new Date();

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              tenantId,
              contactId: contact.id,
              channel: "instagram",
              status: "bot_active",
              mode: "bot",
              lastMessagePreview: messageText,
              lastMessageAt: now,
              unreadCount: 1,
            },
          });
        } else {
          conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              lastMessagePreview: messageText,
              lastMessageAt: now,
              unreadCount: { increment: 1 },
            },
          });
        }

        let message;
        try {
          message = await prisma.message.create({
            data: {
              tenantId,
              conversationId: conversation.id,
              channel: "instagram",
              direction: "in",
              senderType: "customer",
              senderName: contact.name,
              type: "text",
              body: messageText,
              waMessageId: mid,
            },
          });
        } catch {
          continue;
        }

        const full = await prisma.conversation.findUniqueOrThrow({
          where: { id: conversation.id },
          include: { contact: true, assignee: true },
        });

        hub.toTenant(tenantId, "message.created", mapMessage(message));
        hub.toTenant(tenantId, "conversation.updated", mapConversation(full));

        const { scheduleBotReply } = await import("../bot/reply.js");
        scheduleBotReply(conversation.id);
      }
    }

    return { ok: true };
  });

  // Authenticated Channel & Comment Rules Endpoints
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", requireAuth);
    protectedApp.addHook("preHandler", requireTenant);

    // GET /api/v1/channels/instagram/config
    protectedApp.get("/channels/instagram/config", async (request) => {
      const tenantId = request.tenant.tenantId;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          igAccessToken: true,
          igPageId: true,
          igUserId: true,
          igConnected: true,
        },
      });

      return {
        ok: true,
        data: {
          connected: tenant?.igConnected ?? false,
          pageId: tenant?.igPageId || null,
          userId: tenant?.igUserId || null,
          accessTokenMasked: tenant?.igAccessToken
            ? `${tenant.igAccessToken.slice(0, 6)}...${tenant.igAccessToken.slice(-4)}`
            : null,
        },
      };
    });

    // POST /api/v1/channels/instagram/config
    protectedApp.post("/channels/instagram/config", async (request) => {
      const tenantId = request.tenant.tenantId;
      const body = updateConfigSchema.parse(request.body);

      const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          igAccessToken: body.igAccessToken,
          igPageId: body.igPageId || null,
          igUserId: body.igUserId || null,
          igConnected: body.igConnected,
        },
      });

      return {
        ok: true,
        data: {
          connected: updated.igConnected,
          pageId: updated.igPageId,
          userId: updated.igUserId,
        },
      };
    });

    // GET /api/v1/channels/instagram/profile
    protectedApp.get("/channels/instagram/profile", async (request) => {
      const tenantId = request.tenant.tenantId;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { igAccessToken: true, igUserId: true, igConnected: true },
      });

      if (!tenant?.igAccessToken) {
        return { ok: false, data: null, message: "Instagram belum terhubung" };
      }

      const { fetchInstagramProfile } = await import("../channels/instagram.driver.js");
      const profile = await fetchInstagramProfile({
        igUserId: tenant.igUserId,
        accessToken: tenant.igAccessToken,
      });

      return { ok: true, data: profile };
    });

    // GET /api/v1/channels/instagram/media
    protectedApp.get("/channels/instagram/media", async (request) => {
      const tenantId = request.tenant.tenantId;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { igAccessToken: true, igUserId: true, igConnected: true },
      });

      if (!tenant?.igAccessToken || !tenant?.igUserId) {
        return { ok: false, data: [], message: "Instagram belum terhubung" };
      }

      const { fetchInstagramMediaList } = await import("../channels/instagram.driver.js");
      const mediaList = await fetchInstagramMediaList({
        igUserId: tenant.igUserId,
        accessToken: tenant.igAccessToken,
        limit: 12,
      });

      return { ok: true, data: mediaList };
    });

    // GET /api/v1/channels/instagram/comment-rules
    protectedApp.get("/channels/instagram/comment-rules", async (request) => {
      const tenantId = request.tenant.tenantId;
      const rules = await prisma.instagramCommentRule.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });

      return { ok: true, data: rules };
    });

    // POST /api/v1/channels/instagram/comment-rules
    protectedApp.post("/channels/instagram/comment-rules", async (request) => {
      const tenantId = request.tenant.tenantId;
      const body = commentRuleSchema.parse(request.body);

      const rule = await prisma.instagramCommentRule.create({
        data: {
          tenantId,
          name: body.name,
          active: body.active,
          targetPostId: body.targetPostId || null,
          keywords: body.keywords,
          publicReplyText: body.publicReplyText || null,
          privateReplyText: body.privateReplyText,
          flowId: body.flowId || null,
        },
      });

      return { ok: true, data: rule };
    });

    // DELETE /api/v1/channels/instagram/comment-rules/:id
    protectedApp.delete("/channels/instagram/comment-rules/:id", async (request) => {
      const tenantId = request.tenant.tenantId;
      const { id } = request.params as { id: string };

      await prisma.instagramCommentRule.deleteMany({
        where: { id, tenantId },
      });

      return { ok: true };
    });
  });
}
