"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-white font-bold shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
            S
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Senja<span className="text-teal-600">CS</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <Link href="/features" className="text-sky-600 font-bold hover:text-sky-700 transition-colors flex items-center gap-1">
            <span>Katalog Fitur</span>
            <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.5 text-[10px] uppercase font-mono">Hub</span>
          </Link>
          <Link href="/use-cases" className="hover:text-teal-600 transition-colors">
            Contoh Penggunaan
          </Link>
          <a href="/#fitur" className="hover:text-teal-600 transition-colors">Fitur Utama</a>
          <a href="/#engine" className="hover:text-teal-600 transition-colors">Dual Engine</a>
          <a href="/#analytics" className="hover:text-teal-600 transition-colors">AI Analytics</a>
          <a href="/#harga" className="hover:text-teal-600 transition-colors">Harga</a>
          <a href="/#faq" className="hover:text-teal-600 transition-colors">FAQ</a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-slate-700 hover:text-teal-700 hover:bg-teal-50">
              Masuk
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="primary" className="bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20">
              Mulai Sekarang — Gratis
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export { LandingHeader as Header };
