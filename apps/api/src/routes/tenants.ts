import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { TenantRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireTenant, requireRole } from "../lib/auth.js";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "tenant"
  );
}

function mapMember(m: {
  userId: string;
  role: TenantRole;
  status: string;
  user: { name: string; email: string; createdAt: Date };
}) {
  return {
    id: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role as "owner" | "admin" | "agent",
    status: m.status as "active" | "invited" | "disabled",
    joinedAt: m.user.createdAt.toISOString(),
  };
}

async function bindTenantFromParam(
  req: import("fastify").FastifyRequest,
  reply: import("fastify").FastifyReply,
) {
  req.headers["x-tenant-id"] = (req.params as { id: string }).id;
  return requireTenant(req, reply);
}

export async function tenantRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/tenants", async (request) => {
    const memberships = await prisma.tenantMember.findMany({
      where: { userId: request.authUser.id, status: "active" },
      include: { tenant: true },
    });
    return memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      plan: m.tenant.plan,
      role: m.role,
    }));
  });

  app.post("/tenants", async (request, reply) => {
    const body = z.object({ name: z.string().min(1) }).parse(request.body);
    const base = slugify(body.name);
    let slug = base;
    let i = 1;
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }

    const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const tenant = await prisma.tenant.create({
      data: {
        name: body.name,
        slug,
        plan: "starter",
        planExpiresAt: trialExpiresAt,
        members: {
          create: { userId: request.authUser.id, role: "owner" },
        },
        botSettings: { create: {} },
      },
    });

    return reply.code(201).send({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      role: "owner",
    });
  });

  // Current-tenant members (X-Tenant-Id)
  app.get(
    "/team/members",
    {
      preHandler: [requireTenant],
    },
    async (request) => {
      const members = await prisma.tenantMember.findMany({
        where: { tenantId: request.tenant.tenantId },
        include: { user: true },
        orderBy: { id: "asc" },
      });
      return members.map(mapMember);
    },
  );

  app.post(
    "/team/members",
    {
      preHandler: [requireTenant, requireRole("owner", "admin")],
    },
    async (request, reply) => {
      const body = z
        .object({
          email: z.string().email(),
          name: z.string().min(1).max(80).optional(),
          role: z.enum(["admin", "agent"]).default("agent"),
          /** If true and user missing, create account + return tempPassword once */
          createIfMissing: z.boolean().default(true),
        })
        .parse(request.body);

      const email = body.email.toLowerCase();
      let user = await prisma.user.findUnique({ where: { email } });
      let tempPassword: string | undefined;
      let created = false;

      if (!user) {
        if (!body.createIfMissing) {
          return reply.code(404).send({
            error: "User belum daftar. Aktifkan createIfMissing atau minta mereka register dulu.",
          });
        }
        tempPassword = randomBytes(4).toString("hex"); // 8 hex chars
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        const displayName =
          body.name?.trim() || email.split("@")[0] || "Agent";
        user = await prisma.user.create({
          data: {
            email,
            name: displayName,
            passwordHash,
          },
        });
        created = true;
      }

      // cannot demote/add as owner via invite
      if (user.id === request.authUser.id) {
        return reply.code(400).send({ error: "Tidak bisa mengundang diri sendiri" });
      }

      const existing = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: {
            tenantId: request.tenant.tenantId,
            userId: user.id,
          },
        },
      });
      if (existing?.role === "owner") {
        return reply.code(400).send({ error: "User sudah owner tenant ini" });
      }

      const member = await prisma.tenantMember.upsert({
        where: {
          tenantId_userId: {
            tenantId: request.tenant.tenantId,
            userId: user.id,
          },
        },
        create: {
          tenantId: request.tenant.tenantId,
          userId: user.id,
          role: body.role,
          status: "active",
        },
        update: {
          role: body.role,
          status: "active",
        },
        include: { user: true },
      });

      return reply.code(created ? 201 : 200).send({
        ...mapMember(member),
        created,
        tempPassword,
      });
    },
  );

  app.patch(
    "/team/members/:userId",
    {
      preHandler: [requireTenant, requireRole("owner", "admin")],
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = z
        .object({
          role: z.enum(["admin", "agent"]).optional(),
          status: z.enum(["active", "disabled"]).optional(),
        })
        .parse(request.body);

      const target = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: {
            tenantId: request.tenant.tenantId,
            userId,
          },
        },
        include: { user: true },
      });
      if (!target) return reply.code(404).send({ error: "Member not found" });
      if (target.role === "owner") {
        return reply.code(400).send({ error: "Tidak bisa mengubah owner" });
      }
      if (request.tenant.role === "admin" && target.role === "admin" && body.role) {
        return reply.code(403).send({ error: "Admin tidak bisa mengubah role admin lain" });
      }

      const updated = await prisma.tenantMember.update({
        where: { id: target.id },
        data: {
          ...(body.role ? { role: body.role } : {}),
          ...(body.status ? { status: body.status } : {}),
        },
        include: { user: true },
      });
      return mapMember(updated);
    },
  );

  app.delete(
    "/team/members/:userId",
    {
      preHandler: [requireTenant, requireRole("owner", "admin")],
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      if (userId === request.authUser.id) {
        return reply.code(400).send({ error: "Tidak bisa mengeluarkan diri sendiri" });
      }
      const target = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: {
            tenantId: request.tenant.tenantId,
            userId,
          },
        },
      });
      if (!target) return reply.code(404).send({ error: "Member not found" });
      if (target.role === "owner") {
        return reply.code(400).send({ error: "Tidak bisa mengeluarkan owner" });
      }
      if (request.tenant.role === "admin" && target.role === "admin") {
        return reply.code(403).send({ error: "Admin tidak bisa mengeluarkan admin lain" });
      }

      await prisma.tenantMember.update({
        where: { id: target.id },
        data: { status: "disabled" },
      });
      return reply.code(204).send();
    },
  );

  // Legacy path (kept for compatibility)
  app.get(
    "/tenants/:id/members",
    { preHandler: [bindTenantFromParam] },
    async (request) => {
      const members = await prisma.tenantMember.findMany({
        where: { tenantId: request.tenant.tenantId },
        include: { user: true },
      });
      return members.map(mapMember);
    },
  );

  app.post(
    "/tenants/:id/members",
    {
      preHandler: [bindTenantFromParam, requireRole("owner", "admin")],
    },
    async (request, reply) => {
      // delegate shape: same as /team/members
      const body = z
        .object({
          email: z.string().email(),
          name: z.string().min(1).max(80).optional(),
          role: z.enum(["admin", "agent"]).default("agent"),
          createIfMissing: z.boolean().default(true),
        })
        .parse(request.body);

      const email = body.email.toLowerCase();
      let user = await prisma.user.findUnique({ where: { email } });
      let tempPassword: string | undefined;
      let created = false;

      if (!user) {
        if (!body.createIfMissing) {
          return reply
            .code(404)
            .send({ error: "User not found. Ask them to register first." });
        }
        tempPassword = randomBytes(4).toString("hex");
        user = await prisma.user.create({
          data: {
            email,
            name: body.name?.trim() || email.split("@")[0] || "Agent",
            passwordHash: await bcrypt.hash(tempPassword, 10),
          },
        });
        created = true;
      }

      const member = await prisma.tenantMember.upsert({
        where: {
          tenantId_userId: {
            tenantId: request.tenant.tenantId,
            userId: user.id,
          },
        },
        create: {
          tenantId: request.tenant.tenantId,
          userId: user.id,
          role: body.role,
          status: "active",
        },
        update: { role: body.role, status: "active" },
        include: { user: true },
      });

      return reply.code(created ? 201 : 200).send({
        ...mapMember(member),
        created,
        tempPassword,
      });
    },
  );
}
