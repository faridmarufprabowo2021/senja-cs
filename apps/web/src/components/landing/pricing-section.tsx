"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";

const pricingPlans = [
  {
    name: "Starter UMKM",
    price: "Rp 299.000",
    period: "/bulan",
    desc: "Sangat cocok untuk toko online atau usaha kecil yang ingin merintis otomatisasi customer service.",
    features: [
      "1 Nomor WhatsApp (Engine Baileys)",
      "Bot AI Balas Otomatis 24/7",
      "Knowledge Base Dokumen Teks/FAQ",
      "Katalog Produk s/d 50 Produk",
      "1 Single Tenant & 2 Akun CS",
      "Standard Customer Support",
    ],
    popular: false,
    cta: "Mulai Trial Gratis",
  },
  {
    name: "Growth VIP Pro",
    price: "Rp 699.000",
    period: "/bulan",
    desc: "Pilihan paling favorit untuk klinik gigi, salon, dan brand lokal dengan volume chat & booking menengah.",
    features: [
      "2 Nomor WhatsApp (Baileys + Open-WA Stealth)",
      "Semantic Vector Search (pgvector < 15ms)",
      "Autonomous Booking & Reminders H-1 WA",
      "Integrasi QRIS Midtrans & Auto-Nota PDF",
      "AI Sentiment & Sales Analytics Dashboard",
      "Broadcast Campaign s/d 5.000 Pesan/bln",
      "Multi-Agent Inbox & Handover CS (5 Akun)",
    ],
    popular: true,
    cta: "Pilih Growth Pro",
  },
  {
    name: "Enterprise Custom",
    price: "Rp 1.499.000",
    period: "/bulan",
    desc: "Untuk bisnis skala besar, jaringan cabang, atau instansi yang memerlukan jaminan uptime & integrasi khusus.",
    features: [
      "Unlimited Nomor WhatsApp & Multi-Tenant",
      "Open-WA Stealth VIP Dedicated Server",
      "Custom Database Integration & API Webhooks",
      "Dedicated AI Fine-Tuned Model Prompting",
      "Unlimited Broadcast & Multi-Channel Ready",
      "SLA Uptime 99.9% & Account Manager",
    ],
    popular: false,
    cta: "Hubungi Tim Sales",
  },
];

export function LandingPricingSection() {
  return (
    <section id="harga" className="py-20 border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <Badge tone="accent">Paket Langganan</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Pilihan Paket Transparan Sesuai Kebutuhan Bisnis
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Tanpa biaya tersembunyi. Dapatkan seluruh otomatisasi WhatsApp dan AI Commerce dalam 1 langganan.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingPlans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: idx * 0.12 }}
              whileHover={{ y: -6 }}
              className={`relative flex flex-col justify-between rounded-3xl border p-8 bg-white shadow-sm transition-all duration-300 ${
                plan.popular
                  ? "border-teal-500 shadow-xl shadow-teal-500/10 ring-2 ring-teal-500/20 scale-102"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-teal-600 px-4 py-1 text-xs font-black text-white shadow-md">
                  PALING FAVORIT
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">{plan.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                  <span className="text-xs text-slate-500">{plan.period}</span>
                </div>

                <div className="mt-8 space-y-3 text-xs text-slate-700">
                  {plan.features.map((f, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link href="/login">
                  <Button
                    size="lg"
                    className={`w-full font-bold text-sm h-11 ${
                      plan.popular
                        ? "bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
