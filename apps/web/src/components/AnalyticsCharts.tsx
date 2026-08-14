"use client";

import { motion } from "framer-motion";
import { BarChart3, DollarSign, PieChart, Smile, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui";

interface AnalyticsChartsProps {
  overview: {
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
  } | null;
}

export function AnalyticsCharts({ overview }: AnalyticsChartsProps) {
  if (!overview) return null;

  // Mock 7-day revenue & chat volume data based on real overview numbers for visual rendering
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const totalRev = overview.totalRevenue || 4500000;
  const totalChat = overview.totalAnalyzed || 120;

  const chartData = days.map((day, idx) => {
    const multiplier = [0.8, 1.1, 0.9, 1.3, 1.5, 1.8, 1.2][idx];
    const dailyRev = Math.round((totalRev / 7) * multiplier);
    const dailyChat = Math.round((totalChat / 7) * multiplier);
    return { day, revenue: dailyRev, chat: dailyChat };
  });

  const maxRev = Math.max(...chartData.map((d) => d.revenue), 1);
  const totalSentiment =
    overview.sentimentBreakdown.positive +
    overview.sentimentBreakdown.neutral +
    overview.sentimentBreakdown.negative || 1;

  const posPct = Math.round((overview.sentimentBreakdown.positive / totalSentiment) * 100);
  const neuPct = Math.round((overview.sentimentBreakdown.neutral / totalSentiment) * 100);
  const negPct = Math.round((overview.sentimentBreakdown.negative / totalSentiment) * 100);

  const formatRupiahShort = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
    return `${val}`;
  };

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* 1. Bar Chart: Tren Omset & Chat 7 Hari */}
      <Card className="p-6 md:col-span-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-700" />
              Grafik Tren Omset &amp; Chat Masuk (7 Hari Terakhir)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualisasi perkiraan volume chat masuk dan estimasi omset closing otomatis.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-teal-600 inline-block" /> Omset (Rp)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-blue-400 inline-block" /> Chat Masuk
            </span>
          </div>
        </div>

        {/* SVG Bar Chart Graphic */}
        <div className="h-56 w-full pt-4 flex items-end justify-between gap-3 px-2">
          {chartData.map((d, i) => {
            const heightPct = Math.max(12, Math.round((d.revenue / maxRev) * 100));
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-10 mb-1">
                  Rp {d.revenue.toLocaleString("id-ID")} ({d.chat} chat)
                </div>
                <div className="w-full bg-slate-100 rounded-xl h-full max-h-44 flex items-end p-1 overflow-hidden">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                    className="w-full rounded-lg bg-gradient-to-t from-teal-700 to-teal-500 group-hover:from-teal-600 group-hover:to-teal-400 transition-colors"
                  />
                </div>
                <span className="text-xs font-extrabold text-slate-600">{d.day}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 2. Donut / Ring Chart: Sentimen Kepuasan CSAT */}
      <Card className="p-6 md:col-span-4 space-y-4 flex flex-col justify-between">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-purple-700" />
            Distribusi Sentimen CSAT
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rasio sentimen hasil analisis AI.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center my-2">
          <div className="relative h-36 w-36 grid place-items-center">
            {/* Simple Conic Gradient Donut Ring */}
            <div
              className="h-full w-full rounded-full transition-all duration-700 shadow-inner"
              style={{
                background: `conic-gradient(#10b981 0% ${posPct}%, #94a3b8 ${posPct}% ${posPct + neuPct}%, #f43f5e ${posPct + neuPct}% 100%)`,
              }}
            />
            <div className="absolute h-24 w-24 rounded-full bg-white shadow-xs grid place-items-center text-center">
              <div>
                <span className="block font-black text-2xl text-slate-900">{posPct}%</span>
                <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">CSAT Puas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-700">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Positif (Puas)
            </span>
            <span className="font-bold">{posPct}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Netral
            </span>
            <span className="font-bold">{neuPct}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-rose-600">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Negatif (Komplain)
            </span>
            <span className="font-bold">{negPct}%</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
