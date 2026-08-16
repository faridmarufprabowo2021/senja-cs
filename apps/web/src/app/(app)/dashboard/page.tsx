"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  Clock3,
  Inbox,
  MessageSquareText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  Conversation,
  DashboardAnalytics,
  DashboardMetrics,
} from "@cs/shared";
import { STATUS_LABEL } from "@cs/shared";
import { Badge, Button, Card, PageHeader, StatusDot } from "@/components/ui";
import { api, getSession } from "@/lib/api";
import { isManager } from "@/lib/roles";
import { formatRelative } from "@/lib/utils";


const emptyMetrics: DashboardMetrics = {
  openChats: 0,
  waitingAgent: 0,
  botResolvedPct: 0,
  avgFirstResponseSec: 0,
  messagesToday: 0,
};

export default function DashboardPage() {
  const manager = isManager();
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [tenantName, setTenantName] = useState("Workspace");
  const [followupStats, setFollowupStats] = useState<{
    totalFollowupsSent: number;
    stage1Sent: number;
    stage2Sent: number;
    totalConverted: number;
    conversionRate: number;
    recoveredRevenue: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = getSession();
    const t = session?.tenants.find((x) => x.id === session.tenantId);
    if (t) setTenantName(t.name);

    Promise.all([
      api<DashboardMetrics>("/metrics/overview"),
      api<DashboardAnalytics>("/metrics/analytics").catch(() => null),
      api<Conversation[]>("/conversations"),
      api<any>("/analytics/followup-performance").catch(() => null),
    ])
      .then(([m, a, c, f]) => {
        setMetrics(m);
        if (a) setAnalytics(a);
        setRecent(c.slice(0, 5));
        if (f) setFollowupStats(f);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Gagal memuat dashboard"),
      );
  }, []);

  const cards = [
    {
      label: "Chat terbuka",
      value: metrics.openChats,
      icon: Inbox,
      hint: "perlu perhatian",
    },
    {
      label: "Menunggu agent",
      value: metrics.waitingAgent,
      icon: Users,
      hint: "antrian human",
    },
    {
      label: "Diselesaikan bot",
      value: `${metrics.botResolvedPct}%`,
      icon: Bot,
      hint: "tanpa handover",
    },
    {
      label: "First response",
      value:
        metrics.avgFirstResponseSec > 0
          ? `${metrics.avgFirstResponseSec}s`
          : "—",
      icon: Clock3,
      hint: "median first reply hari ini",
    },
  ];

  const maxChats = Math.max(1, ...(analytics?.trends.map((t) => t.chatsInbound) || [1]));
  const maxRevenue = Math.max(1, ...(analytics?.trends.map((t) => t.revenuePaid) || [1]));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title={`Halo, ${tenantName}`}
        description="Ringkasan customer service & analitik transaksi WhatsApp."
        action={
          <Link href="/inbox">
            <Button>
              Buka inbox
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {error ? (
        <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone="accent">
          <StatusDot status="online" />
          API live
        </Badge>
        <Badge>
          <MessageSquareText className="h-3 w-3" />
          {metrics.messagesToday} pesan hari ini
        </Badge>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[var(--color-faint)]">
                    {c.label}
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="text-3xl font-semibold tracking-tight">
                  {c.value}
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{c.hint}</p>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* AI Follow-Up Performance & Recovered Revenue Banner */}
      {followupStats ? (
        <Card className="mb-8 p-5 border-[var(--color-line)] bg-[var(--color-surface)] shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm text-[var(--color-ink)]">Performa AI Follow-Up Engine</h2>
                  <Badge tone="accent">Aktif</Badge>
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  Penjangkauan otomatis & omset yang berhasil diselamatkan AI.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2 lg:pt-0">
              <div className="border-l-2 border-[var(--color-accent)] pl-3">
                <div className="text-[11px] font-medium text-[var(--color-muted)]">Total Follow-Up</div>
                <div className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{followupStats.totalFollowupsSent} Chat</div>
                <div className="text-[10px] text-[var(--color-muted)]">Stage 1: {followupStats.stage1Sent} · Stage 2: {followupStats.stage2Sent}</div>
              </div>

              <div className="border-l-2 border-[var(--color-accent)] pl-3">
                <div className="text-[11px] font-medium text-[var(--color-muted)]">Chat Konversi</div>
                <div className="text-lg font-semibold tracking-tight text-[var(--color-accent)]">{followupStats.totalConverted} Chat</div>
                <div className="text-[10px] text-[var(--color-muted)]">Merespons / booking kembali</div>
              </div>

              <div className="border-l-2 border-[var(--color-accent)] pl-3">
                <div className="text-[11px] font-medium text-[var(--color-muted)]">Conversion Rate</div>
                <div className="text-lg font-semibold tracking-tight text-[var(--color-accent)]">{followupStats.conversionRate}%</div>
                <div className="text-[10px] text-[var(--color-muted)]">Tingkat efektivitas AI</div>
              </div>

              <div className="border-l-2 border-emerald-500 pl-3">
                <div className="text-[11px] font-medium text-[var(--color-muted)]">Omset Diselamatkan</div>
                <div className="text-lg font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                  Rp{followupStats.recoveredRevenue.toLocaleString("id-ID")}
                </div>
                <div className="text-[10px] text-[var(--color-muted)]">Recovered sales revenue</div>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Live Trends & Conversion Funnel */}
      {analytics ? (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Trend Chart */}
          <Card className="p-5">
            <h2 className="mb-1 font-medium">Tren Chat & Omzet (7 Hari)</h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Perbandingan chat WA masuk vs transaksi lunas per hari.
            </p>
            <div className="mt-4 flex h-44 items-end gap-2 pt-4">
              {analytics.trends.map((t) => {
                const chatHeightPct = Math.round((t.chatsInbound / maxChats) * 100);
                const revHeightPct = Math.round((t.revenuePaid / maxRevenue) * 100);
                return (
                  <div
                    key={t.date}
                    className="group relative flex flex-1 flex-col items-center justify-end h-full"
                  >
                    <div className="flex w-full items-end justify-center gap-1 h-36">
                      <div
                        style={{ height: `${Math.max(8, chatHeightPct)}%` }}
                        className="w-1/2 rounded-t bg-[var(--color-accent)] opacity-80 transition hover:opacity-100"
                      />
                      <div
                        style={{ height: `${Math.max(8, revHeightPct)}%` }}
                        className="w-1/2 rounded-t bg-emerald-500 opacity-80 transition hover:opacity-100"
                      />
                    </div>
                    <span className="mt-2 text-[10px] text-[var(--color-muted)]">
                      {t.label}
                    </span>

                    {/* Tooltip */}
                    <div className="absolute -top-12 z-20 hidden rounded-lg bg-neutral-900 px-2 py-1 text-[10px] text-white shadow-md group-hover:block whitespace-nowrap">
                      {t.chatsInbound} chat · Rp{t.revenuePaid.toLocaleString("id-ID")}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-[var(--color-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-[var(--color-accent)]" /> Chat Masuk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Omzet (Paid)
              </span>
            </div>
          </Card>

          {/* Conversion Funnel */}
          <Card className="p-5">
            <h2 className="mb-1 font-medium">Funnel Konversi Chat ➔ Sales</h2>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Tahapan konversi dari percakapan masuk hingga pembayaran.
            </p>
            <div className="space-y-3.5 pt-2">
              {analytics.funnel.map((f) => (
                <div key={f.stage} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{f.label}</span>
                    <span>
                      {f.count} ({f.conversionPct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-paper-2)]">
                    <div
                      style={{ width: `${Math.max(4, f.conversionPct)}%` }}
                      className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Aktivitas terbaru</h2>
            <Link href="/inbox" className="text-xs text-[var(--color-accent)]">
              Lihat semua
            </Link>
          </div>
          <div className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                Belum ada chat. Hubungkan WhatsApp di Channels.
              </p>
            ) : null}
            {recent.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-[var(--color-line)] hover:bg-[var(--color-paper-2)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.contact.name}
                    </span>
                    <Badge
                      tone={
                        c.status === "waiting_agent"
                          ? "warn"
                          : c.status === "bot_active"
                            ? "bot"
                            : "default"
                      }
                    >
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {c.lastMessagePreview}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--color-faint)]">
                  {formatRelative(c.lastMessageAt)}
                </span>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Agent Leaderboard */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-1 font-medium">Leaderboard Performa Agen</h2>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            Agen CS paling aktif menyelesaikan chat pelanggan.
          </p>
          <div className="space-y-2">
            {analytics?.leaderboard.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-[var(--color-line)] p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold text-[var(--color-accent)]">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="text-xs font-medium">{item.name}</div>
                    <div className="text-[10px] text-[var(--color-muted)] capitalize">
                      {item.role}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold">
                    {item.resolvedChats} Chat Selesai
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Rata-rata ~{item.avgResponseSec}s reply
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
