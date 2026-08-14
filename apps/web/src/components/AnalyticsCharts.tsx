"use client";

import { motion } from "framer-motion";
import { PieChart, TrendingUp } from "lucide-react";
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
    dailyTrend?: Array<{
      date: string;
      day: string;
      revenue: number;
      chats: number;
    }>;
  } | null;
}

export function AnalyticsCharts({ overview }: AnalyticsChartsProps) {
  if (!overview) return null;

  const daysFallback = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const chartData =
    overview.dailyTrend && overview.dailyTrend.length > 0
      ? overview.dailyTrend
      : daysFallback.map((day) => ({ day, revenue: 0, chats: 0 }));

  const maxRev = Math.max(...chartData.map((d) => d.revenue), 1);
  const totalSentiment =
    overview.sentimentBreakdown.positive +
      overview.sentimentBreakdown.neutral +
      overview.sentimentBreakdown.negative || 1;

  const posPct = Math.round((overview.sentimentBreakdown.positive / totalSentiment) * 100);
  const neuPct = Math.round((overview.sentimentBreakdown.neutral / totalSentiment) * 100);
  const negPct = Math.round((overview.sentimentBreakdown.negative / totalSentiment) * 100);

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 w-full overflow-hidden">
      {/* 1. Bar Chart: Tren Omset & Chat 7 Hari */}
      <Card className="p-6 lg:col-span-8 space-y-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-700" />
              Grafik Tren Omset &amp; Chat Masuk (7 Hari Terakhir)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Data riil omset lunas (QRIS/Booking) dan volume chat masuk per hari.
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

        {/* CSS Grid Bar Chart - Guaranteed 0 Overflow */}
        <div className="h-52 w-full pt-4 grid grid-cols-7 gap-2 items-end px-1 overflow-hidden">
          {chartData.map((d, i) => {
            const heightPct = d.revenue > 0 ? Math.max(15, Math.round((d.revenue / maxRev) * 100)) : 8;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end group min-w-0">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-20 mb-1">
                  Rp {d.revenue.toLocaleString("id-ID")} ({d.chats} chat)
                </div>

                {/* Bar Container */}
                <div className="w-full bg-slate-100 rounded-xl h-full max-h-36 flex items-end p-1 overflow-hidden relative">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className="w-full rounded-lg bg-gradient-to-t from-teal-700 to-teal-500 group-hover:from-teal-600 group-hover:to-teal-400 transition-colors"
                  />
                  {d.chats > 0 ? (
                    <div
                      className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-2xs"
                      title={`${d.chats} chat`}
                    >
                      {d.chats}
                    </div>
                  ) : null}
                </div>
                <span className="text-xs font-extrabold text-slate-600 truncate">{d.day}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 2. Donut / Ring Chart: Sentimen Kepuasan CSAT */}
      <Card className="p-6 lg:col-span-4 space-y-4 flex flex-col justify-between overflow-hidden">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-purple-700" />
            Distribusi Sentimen CSAT
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rasio sentimen hasil analisis AI otomatis.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center my-2">
          <div className="relative h-36 w-36 grid place-items-center shrink-0">
            {/* Conic Gradient Donut Ring */}
            <div
              className="h-full w-full rounded-full transition-all duration-700 shadow-inner"
              style={{
                background: `conic-gradient(#10b981 0% ${posPct}%, #94a3b8 ${posPct}% ${posPct + neuPct}%, #f43f5e ${posPct + neuPct}% 100%)`,
              }}
            />
            <div className="absolute h-24 w-24 rounded-full bg-white shadow-xs grid place-items-center text-center">
              <div>
                <span className="block font-black text-2xl text-slate-900">{posPct}%</span>
                <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider block">CSAT Puas</span>
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
