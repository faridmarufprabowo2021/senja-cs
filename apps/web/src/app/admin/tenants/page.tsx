"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Clock,
  Radio,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

type TenantAdminItem = {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | "enterprise";
  planExpiresAt: string | null;
  isExpired: boolean;
  daysRemaining: number;
  vertical: string;
  owner: {
    id: string;
    name: string;
    email: string;
  } | null;
  waSessions: {
    id: string;
    status: string;
    phoneE164: string | null;
    engine: string;
  }[];
  stats: {
    members: number;
    orders: number;
    contacts: number;
  };
  createdAt: string;
};

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selectedTenant, setSelectedTenant] = useState<TenantAdminItem | null>(null);
  const [overridePlan, setOverridePlan] = useState<"starter" | "pro" | "enterprise">("pro");
  const [addDays, setAddDays] = useState<number>(7);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadTenants = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (planFilter !== "all") q.set("plan", planFilter);

      const res = await api<TenantAdminItem[]>(`/admin/tenants?${q.toString()}`);
      setTenants(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, planFilter]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  async function handleApplyOverride() {
    if (!selectedTenant) return;
    setSaving(true);
    setMessage("");
    try {
      await api(`/admin/tenants/${selectedTenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan: overridePlan,
          addDays,
        }),
      });

      setMessage(`Sukses! Toko ${selectedTenant.name} diperbarui ke paket ${overridePlan.toUpperCase()} (+${addDays} Hari).`);
      setTimeout(() => {
        setSelectedTenant(null);
        setMessage("");
      }, 1500);
      void loadTenants();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal memperbarui paket toko");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Toko UMKM Terdaftar"
        description="Daftar seluruh workspace, status masa aktif trial, dan override paket toko manual."
      />

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <Input
            placeholder="Cari nama toko atau slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Plan Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--color-line)] bg-white p-1 shadow-xs">
          {[
            { id: "all", label: "Semua Toko" },
            { id: "starter", label: "Starter Trial" },
            { id: "pro", label: "Pro" },
            { id: "enterprise", label: "Enterprise" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPlanFilter(item.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                planFilter === item.id
                  ? "bg-[var(--color-accent)] text-white font-semibold shadow-xs"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Table Card */}
      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)] font-medium">
                <th className="pb-2.5">Toko UMKM</th>
                <th className="pb-2.5">Pemilik (Owner)</th>
                <th className="pb-2.5">Paket Aktif</th>
                <th className="pb-2.5">Sisa Masa Aktif</th>
                <th className="pb-2.5">Sesi WA</th>
                <th className="pb-2.5">Statistik</th>
                <th className="pb-2.5 text-right">Aksi Super Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {tenants.map((t) => {
                const isWaConnected = t.waSessions.some((s) => s.status === "connected");
                return (
                  <tr key={t.id} className="hover:bg-[var(--color-paper-2)]/50 transition">
                    <td className="py-3">
                      <div className="font-semibold text-[var(--color-ink)] text-sm">{t.name}</div>
                      <div className="text-[11px] text-[var(--color-muted)] font-mono">/{t.slug}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-medium text-[var(--color-ink)]">{t.owner?.name || "—"}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">{t.owner?.email || "—"}</div>
                    </td>
                    <td className="py-3">
                      <Badge
                        tone={
                          t.plan === "enterprise"
                            ? "accent"
                            : t.plan === "pro"
                            ? "success"
                            : "warn"
                        }
                        className="uppercase font-semibold tracking-wider text-[10px]"
                      >
                        {t.plan}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {t.isExpired ? (
                        <Badge tone="danger">
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          Expired
                        </Badge>
                      ) : t.plan === "starter" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-warn)]">
                          <Clock className="h-3.5 w-3.5" />
                          Trial: Sisa {t.daysRemaining} Hari
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--color-accent)] font-medium">
                          {t.daysRemaining} Hari Lagi
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          isWaConnected ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"
                        }`}
                      >
                        <Radio className="h-3.5 w-3.5" />
                        {isWaConnected ? "Connected" : "Offline"}
                      </span>
                    </td>
                    <td className="py-3 text-[var(--color-muted)] text-[11px]">
                      <div>Order: <span className="text-[var(--color-ink)] font-mono">{t.stats.orders}</span></div>
                      <div>Kontak: <span className="text-[var(--color-ink)] font-mono">{t.stats.contacts}</span></div>
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedTenant(t);
                          setOverridePlan(t.plan);
                          setAddDays(7);
                          setMessage("");
                        }}
                      >
                        Override Paket / +Trial
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!tenants.length && !loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--color-muted)]">
                    Tidak ditemukan toko yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Override Modal */}
      {selectedTenant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">
              Override Paket & Perpanjang Trial
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Toko: <span className="font-semibold text-[var(--color-accent)]">{selectedTenant.name}</span> (/{selectedTenant.slug})
            </p>

            {message ? (
              <div className="mt-4 rounded-xl bg-[var(--color-accent-soft)] p-3 text-xs text-[var(--color-accent)]">
                {message}
              </div>
            ) : null}

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <label className="mb-1.5 block font-medium text-[var(--color-muted)]">Pilih Paket</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["starter", "pro", "enterprise"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setOverridePlan(p)}
                      className={`rounded-xl border py-2 text-center font-semibold capitalize transition ${
                        overridePlan === p
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                          : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-[var(--color-muted)]">Tambah Masa Aktif (Hari)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { days: 7, label: "+7 Hari Trial" },
                    { days: 30, label: "+30 Hari (1 Bulan)" },
                    { days: 365, label: "+1 Tahun" },
                  ].map((item) => (
                    <button
                      key={item.days}
                      type="button"
                      onClick={() => setAddDays(item.days)}
                      className={`rounded-xl border py-2 text-center font-medium transition ${
                        addDays === item.days
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                          : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--color-line)] pt-4">
              <Button
                variant="ghost"
                onClick={() => setSelectedTenant(null)}
              >
                Batal
              </Button>
              <Button
                disabled={saving}
                onClick={() => void handleApplyOverride()}
              >
                {saving ? "Menyimpan…" : "Simpan Perubahan"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
