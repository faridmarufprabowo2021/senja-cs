"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coffee,
  CreditCard,
  FileSpreadsheet,
  GitBranch,
  Instagram,
  MessageSquare,
  Receipt,
  Scissors,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  UserCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { LandingHeader } from "@/components/landing/header";
import { LandingCtaFooter } from "@/components/landing/cta-footer";

const useCaseCategories = [
  {
    id: "fnb",
    name: "Toko Online & F&B / Cafe",
    icon: Coffee,
    badge: "E-Commerce & Food",
    title: "Otomatisasi Pesanan, Katalog & Payment Link QRIS",
    desc: "Memproses ratusan pesanan harian tanpa antre. Pelanggan melihat katalog foto produk, memilih varian, dan melakukan pembayaran QRIS instan langsung dari WhatsApp / Instagram DM.",
    flowSteps: [
      {
        step: 1,
        title: "Pemicu / Trigger Node",
        desc: "Pelanggan kirim pesan 'menu', 'order', atau 'katalog'.",
        nodeType: "TriggerNode",
      },
      {
        step: 2,
        title: "Kirim Brosur & Foto Menu",
        desc: "Sistem mengirimkan PDF katalog & foto menu terlaris secara otomatis.",
        nodeType: "MediaNode",
      },
      {
        step: 3,
        title: "Pilihan Tombol Instan",
        desc: "Pelanggan memilih tombol '1️⃣ Paket Kopi', '2️⃣ Ricebowl', atau '3️⃣ Tanya AI'.",
        nodeType: "ButtonNode",
      },
      {
        step: 4,
        title: "Payment Link QRIS Midtrans",
        desc: "Sistem meng-generate invoice & link QRIS. Saat lunas, B3 Auto-Nota dikirimkan via WA.",
        nodeType: "ActionNode",
      },
    ],
    results: [
      "⚡ Respon pesanan < 2 detik 24/7",
      "💳 Payment QRIS Lunas Otomatis tanpa cek bukti transfer",
      "📄 Struk Nota PDF otomatis terkirim ke WhatsApp",
    ],
  },
  {
    id: "klinik",
    name: "Klinik & Salon / Jasa Service",
    icon: Stethoscope,
    badge: "Booking & Service",
    title: "Triage Reservasi & Reminders Otomatis H-1",
    desc: "Mencegah pelanggan lupa datang (No-Show). AI mengecek slot dokter/teknisi yang belum terisi, mencatat booking, dan mengirimkan pesan WA pengingat H-1 secara otomatis.",
    flowSteps: [
      {
        step: 1,
        title: "Pemicu / Trigger Node",
        desc: "Pelanggan mengirim kata kunci 'booking', 'jadwal', atau 'servis'.",
        nodeType: "TriggerNode",
      },
      {
        step: 2,
        title: "Filter Jenis Kendala / Layanan",
        desc: "Tombol pilihan: '1️⃣ Servis Rutin (AI)', '2️⃣ AC Bocor / Emergency (CS Manusia)'.",
        nodeType: "ButtonNode",
      },
      {
        step: 3,
        title: "AI Booking Engine",
        desc: "AI RAG mengecek jadwal kosong, mengonfirmasi slot, dan memanggil tool create_booking.",
        nodeType: "AINode",
      },
      {
        step: 4,
        title: "Pengingat Otomatis H-1",
        desc: "Background Engine mengirimkan WA pengingat H-1 jam 09.00 besoknya.",
        nodeType: "ReminderEngine",
      },
    ],
    results: [
      "📉 Angka No-Show (gagal hadir) turun hingga 85%",
      "🚨 Kasus emergency otomatis dialihkan ke CS manusia",
      "⏰ Pengingat H-1 berjalan otomatis di background",
    ],
  },
  {
    id: "b2b",
    name: "B2B, Properti & Automotive",
    icon: Building2,
    badge: "High-Ticket Leads",
    title: "VIP Lead Qualification & Instant Escalation",
    desc: "Memilah pembeli prospek tinggi (VIP) berdasarkan budget dan kebutuhan, lalu menyambungkannya langsung ke Sales Executive via notifikasi lonceng priority.",
    flowSteps: [
      {
        step: 1,
        title: "Pemicu / Trigger Node",
        desc: "Pesan masuk 'pricelist', 'konsultasi', atau 'brosur rumah'.",
        nodeType: "TriggerNode",
      },
      {
        step: 2,
        title: "Brosur Video HD",
        desc: "Sistem mengirimkan video walkthrough & brosur spesifikasi.",
        nodeType: "MediaNode",
      },
      {
        step: 3,
        title: "Kualifikasi Budget",
        desc: "Tombol filter budget: '> 500 Juta (VIP)' vs '< 500 Juta'.",
        nodeType: "ButtonNode",
      },
      {
        step: 4,
        title: "Priority Handover & Webhook CRM",
        desc: "Sync data ke Google Sheets/CRM dan hubungkan pelanggan VIP ke HP Sales Manager.",
        nodeType: "HandoverNode",
      },
    ],
    results: [
      "🎯 Lead VIP langsung ditangani Sales Senior dalam 30 detik",
      "📊 Integrasi webhook real-time ke CRM / Google Sheets",
      "🤖 Lead standar dilayani AI RAG 24 jam",
    ],
  },
];

export default function UseCasesPage() {
  const [activeTab, setActiveTab] = useState("fnb");

  const currentCategory = useCaseCategories.find((c) => c.id === activeTab) || useCaseCategories[0];

  return (
    <div className="min-h-screen bg-[#faf9f6] text-slate-900 font-sans">
      <LandingHeader />

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-teal-50/50 via-white to-[#faf9f6] border-b border-slate-200/60">
        <div className="mx-auto max-w-5xl px-6 text-center space-y-4">
          <Badge tone="accent">Playbook &amp; Contoh Penggunaan</Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Bagaimana Senja CS Mentransformasi Operasional Bisnis Anda
          </h1>
          <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Lihat contoh penerapan nyata kombinasi <strong>Visual Flow Builder 9-Node</strong>, <strong>AI RAG pgvector</strong>, dan <strong>Payment Gateway QRIS</strong> di berbagai sektor industri.
          </p>
        </div>
      </section>

      {/* Interactive Tabs Section */}
      <section className="py-16 mx-auto max-w-7xl px-6">
        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {useCaseCategories.map((cat) => {
            const Icon = cat.icon;
            const active = cat.id === activeTab;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all border ${
                  active
                    ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20 scale-105"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Use Case Content Card */}
        <motion.div
          key={currentCategory.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-xl space-y-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <Badge tone="accent">{currentCategory.badge}</Badge>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                {currentCategory.title}
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
                {currentCategory.desc}
              </p>
            </div>
            <Link href="/login">
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white font-bold">
                Coba Template Ini →
              </Button>
            </Link>
          </div>

          {/* Flow Steps Breakdown */}
          <div>
            <h3 className="font-bold text-base text-slate-900 mb-6 flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-teal-600" />
              Alur Node Flow yang Bekerja Otomatis:
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {currentCategory.flowSteps.map((s) => (
                <div
                  key={s.step}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3 relative hover:border-teal-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="h-7 w-7 rounded-xl bg-teal-600 text-white font-bold text-xs grid place-items-center">
                      {s.step}
                    </span>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-md font-mono">
                      {s.nodeType}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{s.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Key Results */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 space-y-3">
            <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Hasil &amp; Manfaat yang Diperoleh Bisnis:
            </h4>
            <div className="grid gap-2 sm:grid-cols-3 text-xs font-semibold text-emerald-800">
              {currentCategory.results.map((res, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span>{res}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge tone="accent">Teknologi Terbaru</Badge>
            <h2 className="text-3xl font-extrabold text-slate-900">
              Daya Penggerak di Balik Senja CS
            </h2>
            <p className="text-slate-600 text-sm">
              Semua fitur dirancang agar bisnis dapat beroperasi 24 jam tanpa ketergantungan staf manusia.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 grid place-items-center font-bold">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">🔍 AI Source Inspector</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Transparansi penuh di Inbox. Agen CS dapat melihat secara persis dokumen RAG mana yang dibaca AI untuk memberikan jawaban.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 grid place-items-center font-bold">
                🧠
              </div>
              <h3 className="font-bold text-base text-slate-900">✏️ AI Evaluation (Supervised Learning)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Supervisor mengoreksi jawaban salah bot di Inbox. Koreksi langsung menjadi FAQ pgvector baru agar bot instant pintar tanpa retrain.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center font-bold">
                <CreditCard className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">💳 Payment Gateway (Midtrans QRIS)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Link QRIS Midtrans dibuat otomatis di percakapan WA/IG. Begitu dibayar, status order berubah 'Paid' dan B3 Auto-Nota terkirim.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-pink-100 text-pink-700 grid place-items-center font-bold">
                <Instagram className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">📸 Multi-Platform Instagram DM</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Integrasi Meta Graph API 100% Gratis (0 follower requirement). Kelola pesan WA & Instagram DM dalam satu Inbox terpadu.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center font-bold">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">⏰ Automated Reminders Engine</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Background Engine mengirim pesan pengingat WA otomatis H-1 sebelum jadwal booking dan mem-follow up tagihan unpaid.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-700 grid place-items-center font-bold">
                <GitBranch className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">🔀 Visual Flow Builder (9 Nodes)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Canvas bebas seret &amp; lepas dengan node Trigger, Media, Button, Input, Action, AI RAG, Condition, Handover, dan Webhook.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LandingCtaFooter />
    </div>
  );
}
