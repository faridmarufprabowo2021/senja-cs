"use client";

import { motion } from "framer-motion";
import { AlertCircle, BarChart3, Receipt, Smile, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui";

export function LandingAnalyticsPreview() {
  return (
    <section id="analytics" className="py-20 border-t border-slate-200/80 bg-[#faf9f6]">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <Badge tone="accent">AI Analytics &amp; Sentiment</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Pantau Kepuasan Pelanggan &amp; Omset Otomatis Real-Time
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Dashboard analitik LLM yang mengklasifikasi sentimen obrolan, mengukur angka konversi closing, dan mendeteksi potensi komplain.
          </p>
        </motion.div>

        {/* Analytics Card Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-6"
        >
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-transform"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>SKOR CSAT (KEPUASAN)</span>
                <Smile className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">94.8%</div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">🟢 Pelanggan Sangat Puas</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-transform"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>TOTAL OMSET AI BOT</span>
                <TrendingUp className="h-4 w-4 text-teal-600" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">Rp 18.500.000</div>
              <div className="text-[11px] text-teal-700 font-semibold mt-0.5">Transaksi Lunas Terverifikasi</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-transform"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>AI CLOSING RATE</span>
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">42.5%</div>
              <div className="text-[11px] text-purple-700 font-semibold mt-0.5">Konversi Chat ke Pesanan</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-transform"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>ESKALASI CS AGEN</span>
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">3 Chat</div>
              <div className="text-[11px] text-rose-700 font-semibold mt-0.5">Dialihkan ke Agen CS</div>
            </motion.div>
          </div>

          {/* Sample Sentiment Table Stream */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-3">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Daftar Percakapan Teranalisis Sentimen Real-Time
            </div>

            <div className="divide-y divide-slate-200 text-xs sm:text-sm">
              <div className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900">Sari Wijaya (0812-3456-7890)</div>
                  <div className="text-slate-600 text-xs mt-0.5">
                    "Pelanggan menanyakan tarif scaling gigi dan langsung membuat reservasi jadwal &amp; melunasi via QRIS."
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-bold">
                    🟢 Positif (Puas)
                  </span>
                  <span className="font-bold text-emerald-700">Rp 450.000</span>
                </div>
              </div>

              <div className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900">Budi Santoso (0813-9876-5432)</div>
                  <div className="text-slate-600 text-xs mt-0.5">
                    "Pelanggan menanyakan alamat cabang klinik dan jam buka operasional hari Sabtu."
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1 text-xs font-bold">
                    ⚪ Netral (Informasi)
                  </span>
                  <span className="text-slate-400 font-medium">-</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
