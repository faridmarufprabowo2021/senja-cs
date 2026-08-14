"use client";

import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui";

export function LandingEngineComparison() {
  return (
    <section id="engine" className="py-20 border-t border-slate-200/80 bg-[#faf9f6]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column Description */}
          <motion.div
            initial={{ opacity: 0, x: -35 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 space-y-6"
          >
            <Badge tone="accent">Keunggulan Dual Engine</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Satu-Satunya Platform dengan Arsitektur Dual Engine WhatsApp
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Anda tidak perlu mengorbankan kecepatan server atau keamanan akun. Senja CS mendukung perpindahan fleksibel antara Engine Baileys dan Open-WA Stealth Daemon kapan saja.
            </p>
            <div className="space-y-3 text-sm text-slate-700 font-medium">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
                <span>Ganti mode engine dalam 1-klik tanpa kehilangan riwayat chat</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
                <span>Mendukung penuh fitur Multi-Device WhatsApp resmi</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
                <span>Pemulihan sesi otomatis jika koneksi terputus</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column Engine Comparison Table */}
          <motion.div
            initial={{ opacity: 0, x: 35 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-7"
          >
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4 sm:p-5">Parameter</th>
                    <th className="p-4 sm:p-5 text-teal-700">⚡ Baileys Engine</th>
                    <th className="p-4 sm:p-5 text-emerald-700">🛡️ Open-WA Stealth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Konsumsi RAM Server</td>
                    <td className="p-4 sm:p-5">~50 MB (Ultra Hemat)</td>
                    <td className="p-4 sm:p-5">~400 MB (Chromium Daemon)</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Kecepatan Render QR Code</td>
                    <td className="p-4 sm:p-5 font-semibold text-teal-700">Instan (&lt; 1 Detik)</td>
                    <td className="p-4 sm:p-5">Cepat (1 - 2 Detik)</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Proteksi Anti-Blokir Akun</td>
                    <td className="p-4 sm:p-5">Protokol Socket Standar</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-700">VIP Stealth Chromium User-Agent</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Metode Koneksi Protokol</td>
                    <td className="p-4 sm:p-5">Direct Web Socket Sync</td>
                    <td className="p-4 sm:p-5">Headless Browser Client API</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-bold text-slate-900">Cocok Digunakan Untuk</td>
                    <td className="p-4 sm:p-5">Toko Volume Tinggi &amp; UMKM</td>
                    <td className="p-4 sm:p-5">Akun Bisnis Utama / Klinik / VIP</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
