"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, CreditCard, ShieldAlert, Zap } from "lucide-react";
import type { SubscriptionInfo, SubscriptionPlan, SubscriptionTransactionItem } from "@cs/shared";
import { SUBSCRIPTION_PLAN_LABEL } from "@cs/shared";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { isManager } from "@/lib/roles";

const TIERS: {
  id: "pro" | "enterprise";
  name: string;
  price: string;
  badge?: string;
  popular?: boolean;
  features: string[];
}[] = [
  {
    id: "pro",
    name: "Pro",
    price: "Rp199.000",
    badge: "Paling Populer",
    popular: true,
    features: [
      "Masa Aktif 30 Hari",
      "1 Nomor WhatsApp Terhubung",
      "Hingga 5 Anggota Tim (Admin/Agent)",
      "Broadcast WA Blast (Safe Delay 5-15s)",
      "Knowledge Base RAG AI (Doc PDF/FAQ)",
      "CRM Lite & Customer Tagging (LTV)",
      "Export Laporan CSV Penjualan",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Rp499.000",
    features: [
      "Masa Aktif 30 Hari",
      "Multi-Nomor WhatsApp (Hingga 5 Sesi WA)",
      "Unlimited Anggota Tim",
      "Prioritas Queue Broadcast WA Blast",
      "Knowledge Base RAG AI Custom",
      "CRM Lite & Analytics Penuh",
      "Dukungan Teknis Prioritas 24/7",
    ],
  },
];

export default function BillingPage() {
  const manager = isManager();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [history, setHistory] = useState<SubscriptionTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await api<{
        subscription: SubscriptionInfo;
        history: SubscriptionTransactionItem[];
      }>("/subscription");
      setSub(res.subscription);
      setHistory(res.history);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat langganan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCheckout(plan: "pro" | "enterprise") {
    if (!manager) return;
    setCheckoutBusy(plan);
    setError("");
    try {
      const res = await api<{
        ok: boolean;
        snapRedirectUrl: string;
      }>("/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });

      if (res.snapRedirectUrl) {
        window.open(res.snapRedirectUrl, "_blank");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses pembayaran");
    } finally {
      setCheckoutBusy(null);
    }
  }

  async function handleCheckStatus(id: string) {
    setCheckoutBusy(id);
    setError("");
    try {
      const res = await api<{
        ok: boolean;
        message: string;
      }>(`/subscription/check-status/${id}`, {
        method: "POST",
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memverifikasi status pembayaran");
    } finally {
      setCheckoutBusy(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-[var(--color-muted)]">Memuat data langganan…</div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Langganan & Tagihan"
        description="Kelola paket layanan. Selama mode testing, seluruh fitur VIP & Enterprise aktif 100% tanpa biaya."
      />

      <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50/80 p-4 text-xs text-teal-800 flex items-center justify-between gap-3 shadow-sm">
        <div>
          <p className="font-bold text-sm text-teal-900">✨ Mode Pengujian Testing (Akses Penuh VIP Gratis)</p>
          <p className="mt-0.5 text-teal-700">Seluruh fitur Enterprise, AI Bot RAG, Broadcast, CRM Export, & CS Unlimited aktif 100% tanpa perlu pembayaran.</p>
        </div>
        <Badge tone="success" className="px-3 py-1 text-xs">Akses Penuh Aktif</Badge>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-sm text-[var(--color-sunset)]">
          {error}
        </p>
      ) : null}

      {/* Status Card */}
      {sub ? (
        <Card className="mb-8 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-muted)]">Paket Aktif:</span>
                <span className="font-semibold text-lg">{SUBSCRIPTION_PLAN_LABEL[sub.plan]}</span>
                <Badge tone={sub.isExpired ? "danger" : sub.plan === "starter" ? "warn" : "success"}>
                  {sub.isExpired ? "Expired / Kedaluwarsa" : "Aktif"}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-ink-soft)] flex items-center gap-1.5 mt-1">
                <Clock className="h-4 w-4 text-[var(--color-accent)]" />
                {sub.isExpired
                  ? "Masa aktif trial/paket telah habis. Upgrade ke paket Pro untuk membuka akses penuh."
                  : sub.plan === "starter"
                  ? `Masa Trial Starter 3 Hari: sisa ${sub.daysRemaining} hari ${sub.hoursRemaining} jam.`
                  : `Berlaku hingga ${sub.planExpiresAt ? new Date(sub.planExpiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "Selamanya"}.`}
              </p>
            </div>

            {sub.plan === "starter" || sub.isExpired ? (
              <div className="rounded-xl bg-[var(--color-accent-soft)] p-3 text-right">
                <p className="text-xs font-medium text-[var(--color-accent)]">Rekomendasi Paket</p>
                <p className="text-sm font-bold">Upgrade ke Pro Rp199rb/bln</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Pricing Tiers Grid */}
      <div className="mb-10">
        <h2 className="mb-4 text-base font-semibold">Pilih Paket Langganan</h2>
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
          {TIERS.map((tier) => {
            const isCurrent = sub?.plan === tier.id && !sub?.isExpired;
            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col justify-between p-6 transition ${
                  tier.popular ? "border-2 border-[var(--color-accent)] shadow-md" : ""
                }`}
              >
                {tier.badge ? (
                  <span className="absolute -top-3 right-4 rounded-full bg-[var(--color-accent)] px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    {tier.badge}
                  </span>
                ) : null}

                <div>
                  <h3 className="text-lg font-bold text-[var(--color-ink)]">{tier.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-[var(--color-accent)]">{tier.price}</span>
                    <span className="text-xs text-[var(--color-muted)]">/ bulan</span>
                  </div>

                  <ul className="mt-6 space-y-2.5 text-xs text-[var(--color-ink-soft)]">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8">
                  <Button
                    className="w-full justify-center"
                    variant={tier.popular ? "primary" : "secondary"}
                    disabled={!manager || isCurrent || checkoutBusy === tier.id}
                    onClick={() => void handleCheckout(tier.id)}
                  >
                    {isCurrent ? (
                      "Paket Aktif Saat Ini"
                    ) : checkoutBusy === tier.id ? (
                      "Memproses Midtrans…"
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-1" />
                        Pilih Paket {tier.name}
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="mb-4 text-base font-semibold">Riwayat Tagihan & Pembayaran</h2>
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)] font-medium">
                  <th className="pb-2">ID Transaksi</th>
                  <th className="pb-2">Paket</th>
                  <th className="pb-2">Nominal</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Tanggal</th>
                  <th className="pb-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5 font-medium">#{h.id.slice(-6)}</td>
                    <td className="py-2.5 capitalize">{h.plan}</td>
                    <td className="py-2.5">Rp{h.amount.toLocaleString("id-ID")}</td>
                    <td className="py-2.5">
                      <Badge tone={h.status === "paid" ? "success" : h.status === "pending" ? "warn" : "danger"}>
                        {h.status === "paid" ? "Lunas" : h.status === "pending" ? "Menunggu Bayar" : "Gagal"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-[var(--color-muted)]">
                      {new Date(h.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2.5 text-right">
                      {h.status === "pending" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={checkoutBusy === h.id}
                            onClick={() => void handleCheckStatus(h.id)}
                            className="rounded-lg bg-[var(--color-accent-soft)] px-2.5 py-1 font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-white"
                          >
                            {checkoutBusy === h.id ? "Verifikasi…" : "Cek Status Lunas"}
                          </button>
                          {h.snapRedirectUrl ? (
                            <a
                              href={h.snapRedirectUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-[var(--color-accent)] hover:underline"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Bayar
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-medium text-[var(--color-accent)]">✓ Lunas</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!history.length ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-[var(--color-muted)]">
                      Belum ada riwayat tagihan langganan.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
