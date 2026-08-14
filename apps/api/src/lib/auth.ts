import type { FastifyReply, FastifyRequest } from "fastify";
import type { TenantRole } from "@prisma/client";
import { prisma } from "./prisma.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type TenantContext = {
  tenantId: string;
  role: TenantRole;
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string; name: string };
    user: AuthUser;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser;
    tenant: TenantContext;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const payload = await request.jwtVerify<{
      sub: string;
      email: string;
      name: string;
    }>();
    request.authUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function requireTenant(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const header =
    (request.headers["x-tenant-id"] as string | undefined) ||
    (request.query as { tenantId?: string }).tenantId;

  if (!header) {
    return reply.code(400).send({ error: "X-Tenant-Id required" });
  }

  const membership = await prisma.tenantMember.findUnique({
    where: {
      tenantId_userId: {
        tenantId: header,
        userId: request.authUser.id,
      },
    },
  });

  if (!membership || membership.status !== "active") {
    return reply.code(403).send({ error: "Not a member of this tenant" });
  }

  request.tenant = { tenantId: header, role: membership.role };
  request.log = request.log.child({
    tenantId: header,
    role: membership.role,
    userId: request.authUser.id,
  });
}

export function requireRole(...roles: TenantRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.tenant.role)) {
      return reply.code(403).send({ error: "Insufficient role" });
    }
  };
}

export async function requireActiveSubscription(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: request.tenant.tenantId },
    select: { plan: true, planExpiresAt: true },
  });

  if (tenant?.planExpiresAt && tenant.planExpiresAt.getTime() < Date.now()) {
    return reply.code(402).send({
      error: "Masa aktif paket/trial 3 hari telah berakhir. Silakan upgrade paket di Pengaturan Langganan.",
    });
  }
}

export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await prisma.user.findUnique({
    where: { id: request.authUser.id },
    select: { isSuperAdmin: true, email: true },
  });

  const isWhitelisted = user?.email === "sari@warungsenja.id";
  if (!user || (!user.isSuperAdmin && !isWhitelisted)) {
    return reply.code(403).send({ error: "Akses khusus Super Admin Platform" });
  }
}
