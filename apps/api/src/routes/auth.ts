import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  tenantName: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "tenant"
  );
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash,
      },
    });

    let tenant = null;
    if (body.tenantName) {
      const base = slugify(body.tenantName);
      let slug = base;
      let i = 1;
      while (await prisma.tenant.findUnique({ where: { slug } })) {
        slug = `${base}-${i++}`;
      }
      const trialExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      tenant = await prisma.tenant.create({
        data: {
          name: body.tenantName,
          slug,
          plan: "enterprise",
          planExpiresAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000), // 10 years testing access
          members: {
            create: { userId: user.id, role: "owner" },
          },
          botSettings: {
            create: {},
          },
        },
      });
    }

    const token = app.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      tenant,
    };
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    const memberships = await prisma.tenantMember.findMany({
      where: { userId: user.id, status: "active" },
      include: { tenant: true },
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      tenants: memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        plan: m.tenant.plan,
        role: m.role,
      })),
    };
  });

  app.get("/auth/me", { preHandler: [requireAuth] }, async (request) => {
    const memberships = await prisma.tenantMember.findMany({
      where: { userId: request.authUser.id, status: "active" },
      include: { tenant: true },
    });
    return {
      user: request.authUser,
      tenants: memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        plan: m.tenant.plan,
        role: m.role,
      })),
    };
  });
}
