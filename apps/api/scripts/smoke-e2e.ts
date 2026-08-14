/**
 * A3 — Smoke E2E demo (API only, no browser)
 * Run with API up: pnpm --filter @cs/api smoke
 * Or against buildApp inject if API_URL not set and want offline — uses live HTTP by default.
 */
import "dotenv/config";

const BASE = (process.env.API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const EMAIL = process.env.SMOKE_EMAIL ?? "sari@warungsenja.id";
const PASS = process.env.SMOKE_PASSWORD ?? "demo1234";

type Step = { name: string; ok: boolean; detail?: string };

const steps: Step[] = [];

function pass(name: string, detail?: string) {
  steps.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string): never {
  steps.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
  throw new Error(detail);
}

async function req<T>(
  path: string,
  opts: {
    method?: string;
    token?: string;
    tenantId?: string;
    body?: unknown;
  } = {},
): Promise<{ status: number; data: T; headers: Headers }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-Id": `smoke-${Date.now()}`,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["X-Tenant-Id"] = opts.tenantId;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : (null as T);
  } catch {
    data = text as unknown as T;
  }
  return { status: res.status, data, headers: res.headers };
}

async function main() {
  console.log(`\nSmoke E2E → ${BASE}\n`);

  const health = await req<{ ok: boolean }>("/health");
  if (health.status !== 200 || !health.data?.ok) {
    fail("health", `status ${health.status}`);
  }
  pass("health", "ok");

  const login = await req<{
    token: string;
    tenants: { id: string; name: string; role: string }[];
  }>("/api/v1/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASS },
  });
  if (login.status !== 200 || !login.data.token) {
    fail("login", JSON.stringify(login.data));
  }
  const token = login.data.token;
  const tenant = login.data.tenants?.[0];
  if (!tenant?.id) fail("login tenants", "no tenant on demo user");
  pass("login", `${EMAIL} → ${tenant.name}`);

  const rid = login.headers.get("x-request-id");
  if (rid) pass("requestId header", rid);
  else pass("requestId header", "(optional missing)");

  const me = await req<{ user: { email: string } }>("/api/v1/auth/me", {
    token,
  });
  if (me.status !== 200 || me.data.user?.email !== EMAIL) {
    fail("auth/me", JSON.stringify(me.data));
  }
  pass("auth/me");

  const products = await req<unknown[]>("/api/v1/products", {
    token,
    tenantId: tenant.id,
  });
  if (products.status !== 200 || !Array.isArray(products.data)) {
    fail("products", String(products.status));
  }
  pass("katalog products", `${products.data.length} item`);

  const orders = await req<unknown[]>("/api/v1/orders", {
    token,
    tenantId: tenant.id,
  });
  if (orders.status !== 200 || !Array.isArray(orders.data)) {
    fail("orders", String(orders.status));
  }
  pass("pesanan list", `${orders.data.length} order`);

  const convs = await req<unknown[]>("/api/v1/conversations", {
    token,
    tenantId: tenant.id,
  });
  if (convs.status !== 200 || !Array.isArray(convs.data)) {
    fail("inbox", String(convs.status));
  }
  pass("inbox conversations", `${convs.data.length} chat`);

  const wa = await req<unknown[]>("/api/v1/wa/sessions", {
    token,
    tenantId: tenant.id,
  });
  if (wa.status !== 200 || !Array.isArray(wa.data)) {
    fail("wa sessions", String(wa.status));
  }
  pass("wa sessions", `${wa.data.length} sesi`);

  const workspace = await req<{ vertical?: string }>("/api/v1/workspace", {
    token,
    tenantId: tenant.id,
  });
  if (workspace.status !== 200) fail("workspace", String(workspace.status));
  pass("workspace", workspace.data.vertical ?? "ok");

  // Cross-tenant header without membership → 403
  const idor = await req("/api/v1/products", {
    token,
    tenantId: "cm_fake_tenant_idor_smoke",
  });
  if (idor.status !== 403 && idor.status !== 400) {
    fail("isolation smoke", `expected 403, got ${idor.status}`);
  }
  pass("isolation (fake tenant)", String(idor.status));

  const failed = steps.filter((s) => !s.ok);
  console.log(
    `\n${failed.length ? "FAIL" : "PASS"} — ${steps.length - failed.length}/${steps.length} steps\n`,
  );
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
