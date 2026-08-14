"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui";

const workflowSteps = [
  {
    step: "01",
    title: "Hubungkan WhatsApp Bisnis",
    body: "Pilih Engine Baileys atau Open-WA Stealth, lalu scan QR Code dari dashboard dalam hitungan detik tanpa ribet.",
  },
  {
    step: "02",
    title: "Unggah Knowledge & Katalog",
    body: "Unggah dokumen PDF/TXT harga, jam operasional, dan daftar layanan toko. Bot AI langsung menguasai seluruh informasi.",
  },
  {
    step: "03",
    title: "AI Bot Auto-Pesan & Booking",
    body: "Bot menjawab pertanyaan rutin, membuatkan tagihan pesanan, dan mengunci jadwal reservasi secara otomatis 24/7.",
  },
  {
    step: "04",
    title: "Handover ke Agen CS Manusia",
    body: "Saat pelanggan meminta bicara dengan CS atau terdeteksi komplain, obrolan dialihkan ke antrian agen secara utuh.",
  },
];

export function LandingWorkflowSection() {
  return (
    <section id="workflow" className="py-20 border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <Badge tone="accent">Cara Kerja</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            4 Langkah Praktis Mengaktifkan Senja CS
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Siap digunakan dalam 3 menit tanpa memerlukan kemampuan pengkodean (no-code setup).
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {workflowSteps.map((s, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              whileHover={{ y: -4 }}
              className="rounded-3xl border border-slate-200 bg-[#faf9f6] p-6 shadow-sm space-y-4 hover:border-teal-300 transition-all"
            >
              <div className="text-3xl font-black text-teal-600">{s.step}</div>
              <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
