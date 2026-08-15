"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Calendar,
  Receipt,
  Eye,
  TrendingUp,
  Columns,
  Truck,
  Code2,
  ChevronRight,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { FEATURES_DATA } from "@/lib/features-data";
import { Header } from "@/components/landing/header";
import { CtaFooter } from "@/components/landing/cta-footer";

const ICON_MAP: Record<string, any> = {
  Bot,
  Calendar,
  Receipt,
  Eye,
  TrendingUp,
  Columns,
  Truck,
  Code2,
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh] bg-[var(--color-paper-1)] text-[var(--color-ink)] flex flex-col font-sans antialiased">
      {/* Top Navigation */}
      <Header />

      {/* Main Layout Area */}
      <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-8">
        {/* Breadcrumb Header */}
        <div className="mb-6 flex items-center gap-2 text-xs font-mono text-[var(--color-muted)]">
          <Link href="/" className="hover:text-[var(--color-ink)] transition-colors">
            Beranda
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/features" className="hover:text-[var(--color-ink)] transition-colors">
            Katalog Fitur
          </Link>
          {pathname !== "/features" && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-[var(--color-ink)]">
                {FEATURES_DATA.find((f) => `/features/${f.slug}` === pathname)?.title || "Detail Fitur"}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Sidebar Navigation (Sticky Desktop) */}
          <aside className="w-full md:w-72 shrink-0 md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto space-y-6 bg-white/70 backdrop-blur-md rounded-2xl p-5 border border-slate-200/60 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Layers className="h-4 w-4 text-sky-600" />
                <span>Fitur Unggulan</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                8 Fitur
              </span>
            </div>

            {/* Features Navigation Group */}
            <nav className="space-y-1">
              <Link
                href="/features"
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  pathname === "/features"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Semua Fitur (Overview)</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 opacity-60" />
              </Link>

              <div className="pt-3 pb-1 px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Daftar Modul Aplikasi
              </div>

              {FEATURES_DATA.map((feat) => {
                const IconComponent = ICON_MAP[feat.iconName] || Bot;
                const isActive = pathname === `/features/${feat.slug}`;

                return (
                  <Link
                    key={feat.slug}
                    href={`/features/${feat.slug}`}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-sky-50 text-sky-900 font-bold border border-sky-200/80 shadow-xs"
                        : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComponent
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? "text-sky-600" : "text-slate-400 group-hover:text-slate-700"
                        }`}
                      />
                      <span className="truncate">{feat.title}</span>
                    </div>
                    {isActive ? (
                      <span className="h-2 w-2 rounded-full bg-sky-600 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Quick Demo CTA Sidebar Box */}
            <div className="rounded-xl border border-sky-100 bg-linear-to-b from-sky-50/80 to-indigo-50/40 p-4 space-y-2">
              <h4 className="text-xs font-bold text-sky-950">Ingin Menguji Fitur Ini?</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Coba demo interaktif Senja CS langsung di WhatsApp Anda tanpa perlu pendaftaran.
              </p>
              <a
                href="https://wa.me/6289680640009?text=Halo%20Senja%20CS%2C%20saya%20ingin%20coba%20demo%20fitur"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 active:scale-[0.98] transition-all"
              >
                <span>Coba Demo WhatsApp</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </aside>

          {/* Right Main Content Area */}
          <main className="flex-1 min-w-0 w-full">{children}</main>
        </div>
      </div>

      {/* Global Landing Footer */}
      <CtaFooter />
    </div>
  );
}
