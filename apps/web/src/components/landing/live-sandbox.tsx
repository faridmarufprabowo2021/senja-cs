"use client";

import { motion } from "framer-motion";
import { Bot, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";

export function LandingLiveSandbox() {
  const [simText, setSimText] = useState("Halo kak, mau tanya tarif scaling dan jadwal dokter besok ada?");
  const [simResult, setSimResult] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = () => {
    setSimulating(true);
    setSimResult(null);
    setTimeout(() => {
      setSimulating(false);
      setSimResult(
        "Halo Kak! 👋 Untuk Scaling Ringan tarifnya Rp 250.000, dan Scaling Berat Rp 450.000.\n\nJadwal besok Senin jam 14.00 WIB bersama Drg. Anisa masih tersedia! Apakah mau kami bantu reservasi jadwal & buatkan QRIS pembayarannya?",
      );
    }, 800);
  };

  return (
    <section id="demo" className="py-20 border-t border-slate-200/80 bg-[#faf9f6]">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center space-y-3">
          <Badge tone="accent">Simulasi AI Live</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Uji Coba Respon Bot AI Secara Langsung
          </h2>
          <p className="text-sm text-slate-600">
            Ketik pertanyaan pelanggan di bawah untuk melihat bagaimana Bot AI merespon dengan cepat dan akurat.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg space-y-4">
          <div className="flex gap-2 flex-col sm:flex-row">
            <input
              type="text"
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
              placeholder="Ketik pesan simulasi..."
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <Button
              onClick={handleSimulate}
              disabled={simulating}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 shadow-md shadow-teal-600/20"
            >
              {simulating ? <Sparkles className="h-4 w-4 animate-spin" /> : "Kirim Simulasi"}
            </Button>
          </div>

          {simResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-xs text-slate-800 whitespace-pre-line leading-relaxed shadow-xs"
            >
              <div className="font-bold text-teal-900 mb-1 flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-teal-600" /> Respon AI Bot Senja CS:
              </div>
              {simResult}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
