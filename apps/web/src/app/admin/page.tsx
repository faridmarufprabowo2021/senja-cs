"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Radio,
  ShoppingBag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

type AdminMetrics = {
  totalTenants: number;
  mrrRevenue: number;
  planBreakdown: {
    starter: number;
    pro: number;
    enterprise: number;
    expired: number;
  };
  totalOrders: number;
  totalMessages: number;
  activeWaSessions: number;
};

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AdminMetrics>("/admin/metrics")
      .then(setMetrics)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Gagal memuat analitik admin"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-sm text-[var(--color-muted)]">Memuat data analitik admin platform…</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-sunset)]/30 bg-[var(--color-sunset-soft)] p-6 text-sm text-[var(--color-sunset)]">
        <p className="font-semibold">Akses Ditolak / Gagal Memuat Data</p>
        <p className="mt-1 text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ringkasan Platform SaaS"
        description="Performa bisnis platform Senja CS, pendapatan MRR, & statistik seluruh toko terdaftar."
        action={
          <Link href="/admin/tenants">
            <Button>
              <Building2 className="h-4 w-4" />
              Kelola Toko UMKM
            </Button>
          </Link>
        }
      />

      {/* Top 4 Primary KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* MRR Revenue */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">Pendapatan SaaS (MRR)</span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl font-bold text-[var(--color-ink)] tracking-tight">
            Rp{(metrics?.mrrRevenue ?? 0).toLocaleString("id-ID")}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-accent)]">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Total Pembayaran Langganan Lunas</span>
          </div>
        </Card>

        {/* Total Tenants */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">Total Toko UMKM</span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-paper-2)] text-[var(--color-ink)]">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl font-bold text-[var(--color-ink)] tracking-tight">
            {metrics?.totalTenants ?? 0}
          </div>
          <div className="mt-2 text-[11px] text-[var(--color-muted)]">Toko terdaftar di platform</div>
        </Card>

        {/* Active WA Sessions */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">WA Server Engine</span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl font-bold text-[var(--color-accent)] tracking-tight">
            {metrics?.activeWaSessions ?? 0} Online
          </div>
          <div className="mt-2 text-[11px] text-[var(--color-muted)]">Sesi Baileys WA driver aktif</div>
        </Card>

        {/* Total Orders Processed */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">Transaksi Order</span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-2xl font-bold text-[var(--color-ink)] tracking-tight">
            {metrics?.totalOrders ?? 0}
          </div>
          <div className="mt-2 text-[11px] text-[var(--color-muted)]">Total pesanan terproses</div>
        </Card>
      </div>

      {/* Plan Breakdown Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Distribusi Paket Toko
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-muted)]">Trial Starter 3 Hari</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-[var(--color-ink)]">
              {metrics?.planBreakdown.starter ?? 0} Toko
            </div>
          </Card>

          <Card className="border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-accent)]">Paket Pro (Rp199k)</span>
              <Zap className="h-4 w-4 text-[var(--color-accent)]" />
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-[var(--color-accent)]">
              {metrics?.planBreakdown.pro ?? 0} Toko
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-muted)]">Paket Enterprise (Rp499k)</span>
              <Building2 className="h-4 w-4 text-[var(--color-accent)]" />
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-[var(--color-ink)]">
              {metrics?.planBreakdown.enterprise ?? 0} Toko
            </div>
          </Card>

          <Card className="border-[var(--color-sunset)]/40 bg-[var(--color-sunset-soft)]/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-sunset)]">Trial / Paket Expired</span>
              <Clock className="h-4 w-4 text-[var(--color-sunset)]" />
            </div>
            <div className="mt-2 font-mono text-xl font-bold text-[var(--color-sunset)]">
              {metrics?.planBreakdown.expired ?? 0} Toko
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/admin/tenants">
          <Card className="group p-6 transition hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--color-accent)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                    Manajemen Toko & Perpanjang Trial
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Beri bonus trial +7 hari atau ubah paket toko secara manual.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-[var(--color-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--color-accent)]" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/transactions">
          <Card className="group p-6 transition hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--color-accent)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                    Log Transaksi Midtrans SaaS
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Lihat seluruh tagihan & status pelunasan pembayaran langganan.
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-[var(--color-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--color-accent)]" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
