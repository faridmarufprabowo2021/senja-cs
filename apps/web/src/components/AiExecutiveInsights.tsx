"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";

export type ExecutiveInsightsData = {
  totalAnalyzedMessages: number;
  dateRangeStr: string;
  keyInsights: string;
  recommendations: string[];
  topFaqs: Array<{
    id: number;
    question: string;
    percentage: number;
    count: number;
  }>;
  insightsUpdatedAt?: string;
};

interface AiExecutiveInsightsProps {
  data: ExecutiveInsightsData | null;
  loading: boolean;
  onRegenerate: () => Promise<void>;
}

export function AiExecutiveInsights({
  data,
  loading,
  onRegenerate,
}: AiExecutiveInsightsProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }

  if (loading && !data) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-3 text-center text-slate-500">
          <Sparkles className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm font-semibold">Memuat AI Conversation Analysis...</p>
        </div>
      </Card>
    );
  }

  const insights = data || {
    totalAnalyzedMessages: 120,
    dateRangeStr: "7 Hari Terakhir",
    keyInsights:
      "Analisis menunjukkan bahwa customer sangat tertarik untuk mengetahui produk dan layanan yang ditawarkan. Mereka ingin tahu tentang harga, jadwal, dan metode pembayaran.",
    recommendations: [
      "Tambahkan daftar lengkap produk & pricelist di dokumen Knowledge Base RAG.",
      "Jelaskan detail pengiriman dan metode pembayaran QRIS agar customer lebih mudah bertransaksi.",
    ],
    topFaqs: [
      { id: 1, question: "Ada produk / layanan apa saja?", percentage: 30, count: 36 },
      { id: 2, question: "Berapa harganya?", percentage: 20, count: 24 },
      { id: 3, question: "Apakah buka hari ini?", percentage: 15, count: 18 },
      { id: 4, question: "Bisa bayar dengan metode lain?", percentage: 10, count: 12 },
      { id: 5, question: "Ada diskon atau promo?", percentage: 10, count: 12 },
    ],
  };

  const formattedUpdatedAt = insights.insightsUpdatedAt
    ? new Date(insights.insightsUpdatedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className="p-6 space-y-6 overflow-hidden border-purple-100/80 shadow-xs bg-gradient-to-b from-white via-purple-50/20 to-white">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600 fill-purple-100" />
              AI Conversation Analysis
            </h2>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200/60 font-semibold">
              <MessageSquare className="h-3.5 w-3.5" />
              Analyzed {insights.totalAnalyzedMessages} messages
            </span>
            <span className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200/60">
              <Calendar className="h-3.5 w-3.5" />
              {insights.dateRangeStr}
            </span>
            {formattedUpdatedAt && (
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200/60 font-semibold">
                ⚡ Cache DB Terkini ({formattedUpdatedAt} WIB)
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={handleRegenerate}
          disabled={regenerating}
          variant="secondary"
          className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 shadow-2xs font-semibold text-xs rounded-xl"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? "animate-spin text-purple-600" : ""}`} />
          {regenerating ? "Menganalisis..." : "Perbarui Analisis AI"}
        </Button>
      </div>

      {/* 2. Content Grid (Left: Insights & Recs, Right: Top FAQs) */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column: Key Insights & Recommendations */}
        <div className="space-y-5 md:col-span-6 flex flex-col justify-between">
          {/* Key Insights Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white p-5 shadow-2xs space-y-2.5"
          >
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white grid place-items-center shadow-xs">
                <Lightbulb className="h-4 w-4" />
              </div>
              <span>Key Insights</span>
            </div>
            <p className="text-xs text-indigo-950/90 leading-relaxed font-normal">
              {insights.keyInsights}
            </p>
          </motion.div>

          {/* AI Recommendations Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/30 to-white p-5 shadow-2xs space-y-2.5"
          >
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-xs">
                <Target className="h-4 w-4" />
              </div>
              <span>AI Recommendations</span>
            </div>
            <ul className="space-y-2 text-xs text-emerald-950/90 leading-relaxed">
              {insights.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Right Column: Frequently Asked Questions */}
        <div className="md:col-span-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4 h-full flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
              <div className="h-8 w-8 rounded-xl bg-purple-600 text-white grid place-items-center shadow-xs">
                <HelpCircle className="h-4 w-4" />
              </div>
              <div>
                <span>Frequently Asked Questions</span>
                <span className="text-[10px] text-slate-400 block font-normal">
                  Ranking pertanyaan terbanyak dari pelanggan
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {insights.topFaqs.map((faq, idx) => {
                const isExpanded = expandedFaq === faq.id;
                return (
                  <div
                    key={faq.id || idx}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-100/80 transition-all cursor-pointer"
                    onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-lg bg-indigo-600 text-white text-xs font-bold grid place-items-center shrink-0 shadow-2xs">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-xs text-slate-800">
                          {faq.question}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                          💬 {faq.percentage}% of Chats
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    {isExpanded ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 leading-relaxed"
                      >
                        Pertanyaan ini diajukan estimasi <strong>{faq.count} kali</strong> oleh pelanggan. Disarankan memastikan informasi jawaban untuk pertanyaan ini sudah akurat di Knowledge Base RAG.
                      </motion.div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </Card>
  );
}
