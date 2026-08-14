import crypto from "node:crypto";
import { env } from "./env.js";

const BASE_URL = env.MIDTRANS_IS_PRODUCTION
  ? "https://app.midtrans.com/snap/v1"
  : "https://app.sandbox.midtrans.com/snap/v1";

const CORE_API_URL = env.MIDTRANS_IS_PRODUCTION
  ? "https://api.midtrans.com/v2"
  : "https://api.sandbox.midtrans.com/v2";

export type CreateChargeOptions = {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerPhone?: string;
  items?: { name: string; price: number; qty: number }[];
  serverKey?: string;
  isProduction?: boolean;
};

export type ChargeResult = {
  ok: boolean;
  token?: string;
  redirectUrl?: string;
  qrUrl?: string;
  qrString?: string;
  error?: string;
};

export async function createMidtransTransaction(
  opts: CreateChargeOptions,
): Promise<ChargeResult> {
  const serverKey = opts.serverKey?.trim() || env.MIDTRANS_SERVER_KEY;
  const isProd = opts.isProduction ?? env.MIDTRANS_IS_PRODUCTION;
  const baseUrl = isProd
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";

  const authHeader = Buffer.from(`${serverKey}:`).toString("base64");

  // First try Snap API for redirect payment URL
  try {
    const body = {
      transaction_details: {
        order_id: opts.orderId,
        gross_amount: opts.grossAmount,
      },
      customer_details: {
        first_name: opts.customerName,
        phone: opts.customerPhone || "",
      },
      item_details: opts.items?.map((it) => ({
        id: it.name.slice(0, 20),
        price: it.price,
        quantity: it.qty,
        name: it.name,
      })),
      enabled_payments: ["gopay", "shopeepay", "bca_va", "bni_va", "bri_va", "qris"],
    };

    const res = await fetch(`${baseUrl}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      console.warn("[midtrans] snap transaction error", res.status, data);
      return { ok: false, error: data?.error_messages?.join(", ") || "Failed to create transaction" };
    }

    return {
      ok: true,
      token: data.token,
      redirectUrl: data.redirect_url,
    };
  } catch (err) {
    console.error("[midtrans] error creating charge", err);
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Verifies SHA-512 signature hash from Midtrans notification.
 * Signature Formula: SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(payload: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}): boolean {
  if (!payload.order_id || !payload.status_code || !payload.gross_amount || !payload.signature_key) {
    return false;
  }

  const raw = `${payload.order_id}${payload.status_code}${payload.gross_amount}${env.MIDTRANS_SERVER_KEY}`;
  const expectedSignature = crypto.createHash("sha512").update(raw).digest("hex");
  return expectedSignature === payload.signature_key;
}

export async function checkMidtransStatus(orderId: string): Promise<{
  ok: boolean;
  transactionStatus?: string;
  fraudStatus?: string;
  raw?: any;
}> {
  const authHeader = Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString("base64");
  try {
    const res = await fetch(`${CORE_API_URL}/${encodeURIComponent(orderId)}/status`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
        Accept: "application/json",
      },
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      return { ok: false };
    }

    return {
      ok: true,
      transactionStatus: data.transaction_status,
      fraudStatus: data.fraud_status,
      raw: data,
    };
  } catch {
    return { ok: false };
  }
}

/**
 * Validates Midtrans Server Key against Midtrans Sandbox or Production API endpoints.
 */
export async function testMidtransCredentials(opts: {
  serverKey: string;
  isProduction: boolean;
}): Promise<{ ok: boolean; environment: "sandbox" | "production"; error?: string }> {
  const serverKey = opts.serverKey?.trim();
  if (!serverKey) {
    return { ok: false, environment: opts.isProduction ? "production" : "sandbox", error: "Server Key tidak boleh kosong" };
  }

  const baseUrl = opts.isProduction
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";

  const authHeader = Buffer.from(`${serverKey}:`).toString("base64");

  try {
    // Ping fake order status endpoint to test Basic Authentication header with Midtrans API
    const res = await fetch(`${baseUrl}/ping_auth_test_12345/status`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
        Accept: "application/json",
      },
    });

    const data = (await res.json()) as any;
    // Standard Midtrans HTTP responses when Auth succeeds:
    // 404 (Transaction not found) means Auth Key is VALID!
    // 401 (Access Denied / Unauthorized) means Auth Key is INVALID!
    if (res.status === 401 || data?.status_code === "401") {
      return {
        ok: false,
        environment: opts.isProduction ? "production" : "sandbox",
        error: "Server Key Midtrans tidak valid atau tidak sesuai dengan mode (Sandbox vs Production).",
      };
    }

    return {
      ok: true,
      environment: opts.isProduction ? "production" : "sandbox",
    };
  } catch (err) {
    return {
      ok: false,
      environment: opts.isProduction ? "production" : "sandbox",
      error: err instanceof Error ? err.message : "Gagal terhubung ke server Midtrans",
    };
  }
}
