const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Resolve relative media path from API to absolute URL for <img>. */
export function mediaUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const origin = API_URL.replace(/\/api\/v1\/?$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export type Session = {
  token: string;
  user: { id: string; email: string; name: string };
  tenantId: string;
  tenants: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    role: string;
  }[];
};

const STORAGE_KEY = "cs_session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (!session) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function api<T>(
  path: string,
  options: RequestInit & { tenantId?: string; auth?: boolean } = {},
): Promise<T> {
  const session = getSession();
  const headers = new Headers(options.headers);
  const isForm =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!headers.has("Content-Type") && options.body && !isForm) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false && session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }
  const tenantId = options.tenantId ?? session?.tenantId;
  if (tenantId) headers.set("X-Tenant-Id", tenantId);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Tidak bisa hubungi API (${API_URL}). Pastikan server API jalan di :4000.`,
    );
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const data = await api<{
    token: string;
    user: Session["user"];
    tenants: Session["tenants"];
  }>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  });

  const session: Session = {
    token: data.token,
    user: data.user,
    tenants: data.tenants,
    tenantId: data.tenants[0]?.id ?? "",
  };
  setSession(session);
  return session;
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}) {
  const data = await api<{
    token: string;
    user: Session["user"];
    tenant: {
      id: string;
      name: string;
      slug: string;
      plan: string;
    } | null;
  }>("/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify(input),
  });

  const tenants: Session["tenants"] = data.tenant
    ? [
        {
          id: data.tenant.id,
          name: data.tenant.name,
          slug: data.tenant.slug,
          plan: data.tenant.plan,
          role: "owner",
        },
      ]
    : [];

  const session: Session = {
    token: data.token,
    user: data.user,
    tenants,
    tenantId: data.tenant?.id ?? "",
  };
  setSession(session);
  return session;
}

export function wsUrl(token: string, tenantId: string) {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1")
    .replace(/^http/, "ws")
    .replace(/\/$/, "");
  return `${base}/ws?token=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(tenantId)}`;
}
