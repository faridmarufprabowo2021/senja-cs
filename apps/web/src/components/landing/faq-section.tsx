"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui";

const faqs = [
  {
    q: "Apakah aman dari pemblokiran akun WhatsApp?",
    a: "Sangat aman. Senja CS menyediakan Dual Engine Architecture. Anda bisa menggunakan Engine Open-WA Chromium Daemon yang dilengkapi mode stealth VIP untuk menirukan perilaku browser asli pengguna.",
  },
  {
    q: "Bagaimana cara AI mengetahui harga dan layanan usaha saya?",
    a: "Anda cukup mengunggah file PDF, TXT, atau tabel FAQ toko Anda di menu Knowledge Base. AI kami menggunakan teknologi Semantic Vector Search (pgvector) untuk membaca dokumen tersebut secara presisi tanpa berhalusinasi.",
  },
  {
    q: "Apakah pembayaran QRIS otomatis terverifikasi?",
    a: "Ya! Senja CS terintegrasi langsung dengan Payment Gateway Midtrans. Begitu pelanggan melunasi tagihan via QRIS atau Bank Transfer, webhook Midtrans akan memverifikasi pembayaran dan bot akan langsung mengirimkan Nota Resmi PDF ke WhatsApp.",
  },
  {
    q: "Bagaimana jika pelanggan ingin berbicara dengan manusia (CS)?",
    a: "Sistem dilengkapi fitur Handover Otomatis. Jika pelanggan mengetik kata kunci seperti 'CS', 'Admin', atau 'Manusia', atau jika AI mendeteksi sentimen komplain, percakapan langsung dialihkan ke Inbox Agen CS.",
  },
];

export function LandingFaqSection() {
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 border-t border-slate-200/80 bg-[#faf9f6]">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-3"
        >
          <Badge tone="accent">FAQ</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Pertanyaan Sering Diajukan
          </h2>
          <p className="text-sm text-slate-600">
            Temukan jawaban lengkap terkait integrasi, keamanan akun, dan otomatisasi Senja CS.
          </p>
        </motion.div>

        <div className="mt-10 space-y-4">
          {faqs.map((faq, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
            >
              <button
                onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-slate-900 hover:text-teal-700 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${
                    faqOpen === idx ? "rotate-180 text-teal-600" : ""
                  }`}
                />
              </button>
              {faqOpen === idx && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
