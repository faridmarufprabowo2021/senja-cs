import { prisma } from "./prisma.js";
import { waManager } from "../wa/manager.js";
import type { CampaignStatus } from "@cs/shared";

export type CreateCampaignInput = {
  tenantId: string;
  name: string;
  message: string;
  imageUrl?: string | null;
  targetTag?: string | null;
  delayMinSec?: number;
  delayMaxSec?: number;
};

export async function createCampaign(input: CreateCampaignInput) {
  const delayMin = Math.max(1, input.delayMinSec || 5);
  const delayMax = Math.max(delayMin, input.delayMaxSec || 15);
  const targetTag = input.targetTag?.trim() || null;
  const imageUrl = input.imageUrl?.trim() || null;

  // Query contacts matching tenant & optional tag filter
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId: input.tenantId,
      ...(targetTag ? { tags: { has: targetTag } } : {}),
    },
    select: { id: true },
  });

  const campaign = await prisma.campaign.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim(),
      message: input.message,
      imageUrl,
      targetTag,
      delayMinSec: delayMin,
      delayMaxSec: delayMax,
      status: contacts.length > 0 ? "running" : "completed",
      totalCount: contacts.length,
      recipients: {
        create: contacts.map((c) => ({
          contactId: c.id,
          status: "pending",
        })),
      },
    },
    include: {
      recipients: { include: { contact: true } },
    },
  });

  // Trigger background runner asynchronously
  if (contacts.length > 0) {
    executeCampaignBackground(campaign.id).catch((err) => {
      console.error(`[campaign] background runner failed for ${campaign.id}`, err);
    });
  }

  return campaign;
}

export async function executeCampaignBackground(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      tenant: {
        include: {
          waSessions: {
            where: { status: "connected" },
            take: 1,
          },
        },
      },
      recipients: {
        where: { status: "pending" },
        include: { contact: true },
      },
    },
  });

  if (!campaign || campaign.status === "cancelled" || campaign.recipients.length === 0) {
    if (campaign && campaign.status === "running") {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "completed" },
      });
    }
    return;
  }

  const waSession = campaign.tenant.waSessions[0];

  for (const recipient of campaign.recipients) {
    // Check if campaign was cancelled during execution
    const freshState = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (freshState?.status === "cancelled") {
      console.info(`[campaign] execution cancelled for ${campaignId}`);
      break;
    }

    // Random safe delay between min & max seconds
    const delaySec =
      Math.floor(
        Math.random() * (campaign.delayMaxSec - campaign.delayMinSec + 1),
      ) + campaign.delayMinSec;
    await new Promise((res) => setTimeout(res, delaySec * 1000));

    // Personalize message text with {{name}} template
    const textBody = campaign.message.replace(/\{\{\s*name\s*\}\}/gi, recipient.contact.name);

    let sentOk = false;
    let errDetail: string | undefined;

    if (waSession) {
      // Retry sending up to 3 attempts with 2s delay if driver is temporarily initializing
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (campaign.imageUrl) {
            await waManager.sendImage(
              waSession.id,
              recipient.contact.waJid,
              campaign.imageUrl,
              textBody,
            );
          } else {
            await waManager.sendText(
              waSession.id,
              recipient.contact.waJid,
              textBody,
            );
          }
          sentOk = true;
          errDetail = undefined;
          break;
        } catch (err) {
          sentOk = false;
          errDetail = err instanceof Error ? err.message : String(err);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }
    } else {
      errDetail = "No active WhatsApp session connected";
    }

    // Update recipient status
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: sentOk ? "sent" : "failed",
        sentAt: sentOk ? new Date() : null,
        error: errDetail || null,
      },
    });

    // Update campaign counters
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount: { increment: sentOk ? 1 : 0 },
        failedCount: { increment: sentOk ? 0 : 1 },
      },
    });

    // Log message in conversation
    const conv = await prisma.conversation.findFirst({
      where: { tenantId: campaign.tenantId, contactId: recipient.contactId },
    });
    if (conv) {
      await prisma.message.create({
        data: {
          tenantId: campaign.tenantId,
          conversationId: conv.id,
          direction: "out",
          senderType: "system",
          body: textBody,
          metadata: { tool: "broadcast_campaign", campaignId },
        },
      });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessagePreview: `📢 [Broadcast] ${campaign.name}`,
          lastMessageAt: new Date(),
        },
      });
    }
  }

  // Mark campaign completed
  const finalState = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  if (finalState && finalState.status !== "cancelled") {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
  }
}

export async function cancelCampaign(tenantId: string, campaignId: string) {
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
  });
  if (!existing) return null;

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "cancelled" as CampaignStatus },
  });
}
