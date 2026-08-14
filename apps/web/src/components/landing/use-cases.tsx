"use client";

import { motion } from "framer-motion";
import { Building2, CalendarCheck, ShoppingBag, Sparkles, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui";

const useCases = [
  {
    title: "Klinik Gigi & Dokter Praktik",
    desc: "AI menjawab pertanyaan seputar tarif tindakan medis, memeriksa slot jadwal dokter yang belum terisi, dan mengirimkan pesan WA pengingat otomatis H-1 kedatangan.",
    icon: UserCheck,
    perks: ["Pencegah Bentrok Slot Dokter", "WA Reminders H-1 Otomatis", "QRIS Dp/Pelunasan Instan"],
    color: "bg-teal-50 border-teal-200 text-teal-900",
  },
  {
    title: "Toko Online & E-Commerce",
    desc: "Bot AI membaca seluruh katalog barang, menjawab stok & ongkir, membuat draf tagihan pesanan, dan meng-generate Nota PDF Resmi saat terverifikasi Lunas.",
    icon: ShoppingBag,
    perks: ["Auto-Extract Katalog Dokumen", "Integration QRIS Midtrans", "Recovery Tagihan Pending"],
    color: "bg-emerald-50 border-emerald-200 text-emerald-900",
  },
  {
    title: "Salon, Spa & Beauty Care",
    desc: "Memudahkan pelanggan memesan jadwal perawatan, memilih therapist favorit, dan melakukan pembayaran DP awal untuk mengunci slot janji temu.",
    icon: Sparkles,
    perks: ["Multi-Therapist Scheduling", "Status Terjaga 24/7 Nonstop", "Eskalasi Komplain Dini"],
    color: "bg-amber-50 border-amber-200 text-amber-900",
  },
  {
    title: "Penyedia Jasa & Konsultan",
    desc: "Otomatisasi pengumpulan kuesioner kebutuhan klien, koordinasi jam konsultasi, hingga pengiriman bukti transaksi pembayaran.",
    icon: Building2,
    perks: ["RAG Knowledge Base Dokumen", "Handover CS Otomatis", "Multi-Agent Chat Console"],
    color: "bg-blue-50 border-blue-200 text-blue-900",
  },
];

export function LandingUseCases() {
  return (
    <section id="solusi" className="py-20 border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <Badge tone="accent">Solusi Industri</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Didesain Spesifik untuk Berbagai Sektor Usaha Anda
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Senja CS beradaptasi secara dinamis mengikuti karakter dan kebutuhan alur kerja bisnis Anda.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map((uc, idx) => {
            const IconComp = uc.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className={`rounded-3xl border p-8 ${uc.color} shadow-sm space-y-5 transition-all`}
              >
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm border border-slate-200/60">
                    <IconComp className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{uc.title}</h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{uc.desc}</p>

                <div className="pt-4 border-t border-slate-200/60 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                  {uc.perks.map((p, pIdx) => (
                    <span key={pIdx} className="rounded-lg bg-white px-3 py-1 border border-slate-200/60 shadow-2xs">
                      ✓ {p}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
