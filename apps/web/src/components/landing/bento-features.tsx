"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  CalendarCheck,
  Clock,
  Command,
  CreditCard,
  Database,
  GitBranch,
  Instagram,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui";

const bentoFeatures = [
  {
    span: "col-span-12 lg:col-span-7",
    badge: "Supervised Real-Time Learning",
    title: "✏️ AI Evaluation & AI Source Inspector",
    desc: "Transparansi penuh di Inbox. Agen dapat melihat persis sumber dokumen RAG yang digunakan AI. Jika balasan bot kurang tepat, supervisor cukup mengeklik 'Koreksi AI' 1x untuk mengajarkan jawaban benar yang otomatis tersimpan ke Knowledge Base pgvector.",
    icon: Sparkles,
    highlight: [
      "🔍 RAG Source Transparency",
      "🧠 Real-Time Closed-Loop Learning",
      "⚡ Auto-Inject to System Memory",
    ],
    bgClass: "bg-gradient-to-br from-white via-purple-50/40 to-pink-50/60 border-purple-200/80",
  },
  {
    span: "col-span-12 lg:col-span-5",
    badge: "Multi-Platform 100% Free",
    title: "📸 Instagram DM + WhatsApp Unified Inbox",
    desc: "Integrasi Meta Graph API resmi tanpa biaya per-pesan (Rp 0) dan 0 syarat follower. Seluruh pesan dari WhatsApp & Instagram DM masuk ke antrian Inbox terpadu yang dilayani AI RAG secara seragam.",
    icon: Instagram,
    highlight: [
      "0️⃣ Rp 0 Meta API Fee",
      "📲 0 Follower Requirement",
      "💬 Unified Channel Inbox",
    ],
    bgClass: "bg-gradient-to-br from-white via-pink-50/40 to-rose-50/60 border-pink-200/80",
  },
  {
    span: "col-span-12 lg:col-span-4",
    badge: "Visual Automation Engine",
    title: "🔀 Visual Flow Builder (9 Native Nodes)",
    desc: "Canvas bebas seret & lepas dengan 9 jenis node lengkap: Trigger, Media, Button, Input, Action, AI RAG, Condition, Handover, dan Webhook.",
    icon: GitBranch,
    highlight: ["🎨 Drag & Drop Editor", "🔘 Interactive WA Buttons"],
    bgClass: "bg-white border-slate-200",
  },
  {
    span: "col-span-12 lg:col-span-4",
    badge: "Payment Gateway",
    title: "💳 Payment Link QRIS & Auto-Nota",
    desc: "Link QRIS Midtrans dibuat otomatis di percakapan WA. Begitu pelanggan membayar, status order otomatis Paid dan B3 Auto-Nota PDF terkirim instan.",
    icon: CreditCard,
    highlight: ["⚡ Midtrans Snap QRIS", "📄 B3 Auto-Nota PDF"],
    bgClass: "bg-white border-slate-200",
  },
  {
    span: "col-span-12 lg:col-span-4",
    badge: "Automated Reminders",
    title: "⏰ Engine Pengingat H-1 & Follow-Up",
    desc: "Background Engine yang otomatis berjalan untuk mengirimkan WA pengingat H-1 jadwal booking dan mem-follow up tagihan belum lunas secara otomatis.",
    icon: Clock,
    highlight: ["📅 H-1 Booking Reminder", "🔔 Unpaid Order Follow-Up"],
    bgClass: "bg-white border-slate-200",
  },
  {
    span: "col-span-12 lg:col-span-7",
    badge: "Hybrid Protocol",
    title: "Dual WhatsApp Engine (Baileys + Open-WA Stealth)",
    desc: "Bebas memilih antara protokol Baileys Direct Socket (~50MB RAM) untuk kecepatan respon super cepat, atau Open-WA Chromium Daemon untuk proteksi stealth VIP anti-blokir akun utama Anda.",
    icon: ShieldCheck,
    highlight: [
      "⚡ Baileys: Direct Socket Protocol",
      "🛡️ Open-WA: Chromium Stealth Daemon",
      "🔄 Auto-reconnect & session recovery",
    ],
    bgClass: "bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/60 border-teal-200/80",
  },
  {
    span: "col-span-12 lg:col-span-5",
    badge: "Vector RAG Engine",
    title: "Knowledge Ingestion pgvector (Cosine HNSW)",
    desc: "Unggah dokumen PDF/TXT FAQ toko. AI Bot mencari konteks via vector similarity HNSW (<15ms) tanpa pernah berhalusinasi atau salah harga.",
    icon: Database,
    highlight: ["🔍 PostgreSQL pgvector Native", "📚 PDF/TXT Parsing"],
    bgClass: "bg-white border-slate-200",
  },
];

export function LandingBentoFeatures() {
  return (
    <section id="fitur" className="py-20 border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <Badge tone="accent">Fitur Unggulan</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Arsitektur Modern untuk Pengalaman CS &amp; Penjualan Kelas Atas
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Dirancang khusus untuk mendukung operasional toko online, klinik gigi, salon, dan penyedia jasa dengan efisiensi maksimal.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-12 gap-6">
          {bentoFeatures.map((feat, idx) => {
            const IconComp = feat.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className={`${feat.span} rounded-3xl border p-8 shadow-sm ${feat.bgClass} flex flex-col justify-between transition-all`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-100/80 text-teal-700 shadow-sm">
                      <IconComp className="h-6 w-6" />
                    </div>
                    <Badge tone="accent">{feat.badge}</Badge>
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-slate-900">{feat.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{feat.desc}</p>
                </div>

                {feat.highlight && (
                  <div className="mt-6 pt-4 border-t border-slate-200/60 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                    {feat.highlight.map((h, hIdx) => (
                      <span key={hIdx} className="rounded-lg bg-slate-100/80 px-2.5 py-1 border border-slate-200/60">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
