"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

export function LandingCtaFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white pt-20 pb-12">
      <div className="mx-auto max-w-7xl px-6 space-y-16">
        {/* Massive CTA Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 via-emerald-50/60 to-white p-10 md:p-14 text-center space-y-6 shadow-xl shadow-teal-500/5">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight max-w-2xl mx-auto leading-tight">
            Siap Mengotomatiskan Customer Service WA Anda Hari Ini?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
            Bergabunglah dengan ratusan UMKM, klinik, dan bisnis modern yang menghemat waktu dan melejitkan omset penjualan bersama Senja CS.
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-lg shadow-teal-600/25">
                Mulai Demo Gratis Sekarang <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer Credit & Links */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-md bg-teal-600 text-white font-bold text-xs shadow-xs">
              S
            </div>
            <span className="font-bold text-slate-800">Senja CS</span>
            <span>© 2026 Omnichannel AI Customer Service &amp; Commerce Platform. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <Link href="/login" className="hover:text-teal-600 transition-colors">Masuk</Link>
            <Link href="/login" className="hover:text-teal-600 transition-colors">Demo</Link>
            <Link href="/login" className="hover:text-teal-600 transition-colors">Kebijakan Privasi</Link>
            <Link href="/login" className="hover:text-teal-600 transition-colors">Bantuan Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
