"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Filter,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Search,
  ShoppingBag,
  Smile,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";
import { Button, Card, PageHeader } from "@/components/ui";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";
import { AiExecutiveInsights, ExecutiveInsightsData } from "@/components/AiExecutiveInsights";

type AnalyticsOverview = {
  ok: boolean;
  totalAnalyzed: number;
  csatPercentage: number;
  totalRevenue: number;
  conversionRate: number;
  complaintCount: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  intentBreakdown: {
    inquiry: number;
    booking: number;
    order: number;
    complaint: number;
    support: number;
  };
  dailyTrend?: Array<{
    date: string;
    day: string;
    revenue: number;
    chats: number;
  }>;
};

type AnalyzedConversation = {
  id: string;
  conversationId: string;
  contactName: string;
  contactPhone: string;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  intentCategory: "inquiry" | "booking" | "order" | "complaint" | "support";
  summary: string;
  isConverted: boolean;
  revenue: number;
  updatedAt: string;
};

import { DailyReportSettingsModal } from "@/components/DailyReportSettingsModal";
import { Send } from "lucide-react";

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [conversations, setConversations] = useState<AnalyzedConversation[]>([]);
  const [insights, setInsights] = useState<ExecutiveInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const filteredConversations = conversations.filter((c) => {
    if (sentimentFilter !== "all" && c.sentiment !== sentimentFilter) return false;
    if (intentFilter !== "all" && c.intentCategory !== intentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.contactName.toLowerCase().includes(q);
      const matchPhone = c.contactPhone.toLowerCase().includes(q);
      const matchSummary = c.summary.toLowerCase().includes(q);
      return matchName || matchPhone || matchSummary;
    }
    return true;
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadingInsights(true);
    try {
      const [ov, convs, ins] = await Promise.all([
        api<AnalyticsOverview>("/analytics/overview"),
        api<{ ok: boolean; data: AnalyzedConversation[] }>("/analytics/conversations"),
        api<{ ok: boolean; data: ExecutiveInsightsData }>("/analytics/insights").catch(() => null),
      ]);
      setOverview(ov);
      setConversations(convs.data || []);
      if (ins?.data) setInsights(ins.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setLoadingInsights(false);
    }
  }, []);

  const handleRegenerateInsights = async () => {
    try {
      const res = await api<{ ok: boolean; data: ExecutiveInsightsData }>("/analytics/insights/regenerate", { method: "POST" });
      if (res.data) setInsights(res.data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtime((event) => {
    if (event === "analytics.updated" || event === "order.updated" || event === "notification.created") {
      void loadData();
    }
  });

  async function reanalyze(conversationId: string) {
    setAnalyzingId(conversationId);
    try {
      await api(`/analytics/analyze/${conversationId}`, { method: "POST" });
      await loadData();
    } catch {
      /* ignore */
    } finally {
      setAnalyzingId(null);
    }
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <Smile className="h-3.5 w-3.5" /> Positif (Puas)
          </span>
        );
      case "negative":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
            <AlertCircle className="h-3.5 w-3.5" /> Negatif (Komplain)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
            <HelpCircle className="h-3.5 w-3.5" /> Netral
          </span>
        );
    }
  };

  const getIntentBadge = (intent: string) => {
    const map: Record<string, { label: string; bg: string }> = {
      booking: { label: "Reservasi / Booking", bg: "bg-teal-50 text-teal-700 border-teal-200" },
      order: { label: "Pembelian Produk", bg: "bg-blue-50 text-blue-700 border-blue-200" },
      complaint: { label: "Keluhan Pelanggan", bg: "bg-rose-50 text-rose-700 border-rose-200" },
      inquiry: { label: "Tanya Informasi", bg: "bg-purple-50 text-purple-700 border-purple-200" },
      support: { label: "Bantuan Umum", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    };
    const item = map[intent] || { label: intent, bg: "bg-slate-100 text-slate-700 border-slate-200" };
    return (
      <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${item.bg}`}>
        {item.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        description="Analisis sentimen kepuasan pelanggan, performa konversi omset AI Bot, dan eskalasi komplain."
        title="AI Sentiment & Sales Analytics"
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsReportModalOpen(true)}
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold"
            >
              <Send className="mr-2 h-4 w-4" /> ✈️ Laporan Telegram &amp; WA
            </Button>
            <Button onClick={() => void loadData()} variant="secondary">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh Analytics
            </Button>
          </div>
        }
      />

      <DailyReportSettingsModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      {loading ? (
        <div className="grid h-64 place-items-center">
          <div className="flex flex-col items-center gap-3 text-[var(--color-muted)]">
            <Sparkles className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
            <p className="text-sm font-medium">Menganalisis sentimen percakapan AI...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Visual Trend Charts (Omset & CSAT Donut) */}
          <AnalyticsCharts overview={overview} />

          {/* AI Conversation Analysis (Key Insights, AI Recommendations, & Top FAQs) */}
          <AiExecutiveInsights
            data={insights}
            loading={loadingInsights}
            onRegenerate={handleRegenerateInsights}
          />

          {/* KPI Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Kepuasan Pelanggan (CSAT)
                  </span>
                  <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                    <Smile className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[var(--color-text)]">
                    {overview?.csatPercentage ?? 100}%
                  </span>
                  <span className="text-xs font-medium text-emerald-600">Positif</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Dari {overview?.totalAnalyzed ?? 0} percakapan dianalisis AI
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Omset Otomatis Bot AI
                  </span>
                  <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-[var(--color-text)]">
                    {formatRupiah(overview?.totalRevenue ?? 0)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Total transaksi lunas via QRIS/Booking
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    AI Conversion Rate
                  </span>
                  <div className="rounded-xl bg-purple-100 p-2.5 text-purple-700">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[var(--color-text)]">
                    {overview?.conversionRate ?? 0}%
                  </span>
                  <span className="text-xs font-medium text-purple-600">Closing</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Chat WA yang sukses menjadi pesanan/booking
                </p>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Eskalasi Komplain CS
                  </span>
                  <div className="rounded-xl bg-rose-100 p-2.5 text-rose-700">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[var(--color-text)]">
                    {overview?.complaintCount ?? 0}
                  </span>
                  <span className="text-xs font-medium text-rose-600">Perlu Penanganan</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Percakapan bernuansa keluhan/batal
                </p>
              </Card>
            </motion.div>
          </div>

          {/* Breakdown Widgets */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Sentiment Breakdown */}
            <Card className="p-6">
              <h3 className="flex items-center gap-2 text-base font-bold text-[var(--color-text)]">
                <Smile className="h-5 w-5 text-emerald-600" /> Rasio Sentimen Percakapan
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Klasifikasi tingkat kepuasan hasil analisis AI pada percakapan pelanggan.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-emerald-700">🟢 Positif (Puas & Ramah)</span>
                    <span>{overview?.sentimentBreakdown.positive ?? 0} Chat</span>
                  </div>
                  <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${
                          overview?.totalAnalyzed
                            ? Math.round((overview.sentimentBreakdown.positive / overview.totalAnalyzed) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">⚪ Netral (Informatif / Pertanyaan Umum)</span>
                    <span>{overview?.sentimentBreakdown.neutral ?? 0} Chat</span>
                  </div>
                  <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-slate-400 transition-all duration-500"
                      style={{
                        width: `${
                          overview?.totalAnalyzed
                            ? Math.round((overview.sentimentBreakdown.neutral / overview.totalAnalyzed) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-rose-700">🔴 Negatif (Keluhan / Batal / Frustrasi)</span>
                    <span>{overview?.sentimentBreakdown.negative ?? 0} Chat</span>
                  </div>
                  <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-rose-500 transition-all duration-500"
                      style={{
                        width: `${
                          overview?.totalAnalyzed
                            ? Math.round((overview.sentimentBreakdown.negative / overview.totalAnalyzed) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Intent Breakdown */}
            <Card className="p-6">
              <h3 className="flex items-center gap-2 text-base font-bold text-[var(--color-text)]">
                <BarChart3 className="h-5 w-5 text-purple-600" /> Top Kategori Intensi Chat
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Distribusi topik tujuan percakapan yang paling sering ditanyakan pelanggan.
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] p-3 text-xs">
                  <span className="flex items-center gap-2 font-medium">
                    <HelpCircle className="h-4 w-4 text-purple-600" /> Tanya Informasi / Layanan
                  </span>
                  <span className="font-bold text-[var(--color-text)]">
                    {overview?.intentBreakdown.inquiry ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] p-3 text-xs">
                  <span className="flex items-center gap-2 font-medium">
                    <UserCheck className="h-4 w-4 text-teal-600" /> Reservasi / Booking Dokter/Jasa
                  </span>
                  <span className="font-bold text-[var(--color-text)]">
                    {overview?.intentBreakdown.booking ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] p-3 text-xs">
                  <span className="flex items-center gap-2 font-medium">
                    <ShoppingBag className="h-4 w-4 text-blue-600" /> Pembelian Produk / Katalog
                  </span>
                  <span className="font-bold text-[var(--color-text)]">
                    {overview?.intentBreakdown.order ?? 0}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] p-3 text-xs">
                  <span className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4 text-rose-600" /> Keluhan & Komplain
                  </span>
                  <span className="font-bold text-[var(--color-text)]">
                    {overview?.intentBreakdown.complaint ?? 0}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Conversations Table with Sentiment & Intent Filters */}
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--color-line)] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)]">
                    Daftar Percakapan Teranalisis AI
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    Hasil penilaian sentimen, rangkuman otomatis AI, dan status transaksi per pelanggan.
                  </p>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari pelanggan / rangkuman..."
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-purple-500 font-medium"
                  />
                </div>
              </div>

              {/* Filter Pills Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
                {/* Sentiment Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "all", label: "Semua Sentimen", count: conversations.length },
                    { id: "positive", label: "🟢 Positif (Puas)", count: conversations.filter((c) => c.sentiment === "positive").length },
                    { id: "neutral", label: "⚪ Netral", count: conversations.filter((c) => c.sentiment === "neutral").length },
                    { id: "negative", label: "🔴 Negatif (Komplain)", count: conversations.filter((c) => c.sentiment === "negative").length },
                  ].map((tab) => {
                    const active = sentimentFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSentimentFilter(tab.id)}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          active
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Intent Filter Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Filter className="h-3.5 w-3.5 text-purple-600" /> Intensi:
                  </span>
                  <select
                    value={intentFilter}
                    onChange={(e) => setIntentFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="all">Semua Intensi</option>
                    <option value="inquiry">Tanya Informasi</option>
                    <option value="booking">Reservasi / Booking</option>
                    <option value="order">Pembelian Produk</option>
                    <option value="complaint">Keluhan & Komplain</option>
                    <option value="support">Bantuan Umum</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--color-muted)]">
                <MessageSquare className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-base font-semibold text-[var(--color-text)]">Percakapan Tidak Ditemukan</p>
                <p className="mt-1 text-xs max-w-sm">
                  Tidak ada percakapan teranalisis yang sesuai dengan filter sentimen atau pencarian yang dipilih.
                </p>
                {(sentimentFilter !== "all" || intentFilter !== "all" || searchQuery) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => {
                      setSentimentFilter("all");
                      setIntentFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    Reset Filter
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--color-line)] bg-slate-50 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-5 py-3.5">Pelanggan</th>
                      <th className="px-5 py-3.5">Sentimen</th>
                      <th className="px-5 py-3.5">Kategori Intensi</th>
                      <th className="px-5 py-3.5">Rangkuman AI</th>
                      <th className="px-5 py-3.5">Total Omset</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {filteredConversations.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-medium text-[var(--color-text)]">{c.contactName}</div>
                          <div className="text-xs text-[var(--color-muted)]">{c.contactPhone}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">{getSentimentBadge(c.sentiment)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{getIntentBadge(c.intentCategory)}</td>
                        <td className="px-5 py-4 text-xs text-[var(--color-text)] max-w-xs">
                          {c.summary}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-medium">
                          {c.revenue > 0 ? (
                            <span className="font-bold text-emerald-700">
                              {formatRupiah(c.revenue)}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-muted)]">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void reanalyze(c.conversationId)}
                              disabled={analyzingId === c.conversationId}
                            >
                              <Sparkles className={`h-3.5 w-3.5 ${analyzingId === c.conversationId ? "animate-spin text-purple-600" : ""}`} />
                            </Button>
                            <Link href={`/inbox?cid=${c.conversationId}`}>
                              <Button size="sm" variant="secondary">
                                <MessageSquare className="mr-1 h-3.5 w-3.5" /> Buka Chat
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
