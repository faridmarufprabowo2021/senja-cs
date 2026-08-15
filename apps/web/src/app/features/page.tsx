"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bot,
  Calendar,
  Receipt,
  Eye,
  TrendingUp,
  Columns,
  Truck,
  Code2,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { FEATURES_DATA } from "@/lib/features-data";

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

export default function FeaturesOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Hero Banner Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 md:p-10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)] space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1 text-xs font-bold text-sky-700 border border-sky-200/80">
          <Zap className="h-3.5 w-3.5 text-sky-600" />
          <span>Product Capabilities &amp; Feature Tour</span>
        </div>
        <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Eksplorasi Seluruh Kemampuan Otomasi <span className="text-sky-600">Senja CS</span>
        </h1>
        <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
          Platform AI Customer Service terpadu yang memadukan percakapan cerdas WhatsApp &amp; Instagram, reservasi jadwal otomatis, verifikasi pembayaran QRIS, hingga penerbitan nota digital B3.
        </p>

        {/* Feature Highlights Quick Pills */}
        <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Dual-Failover LLM Engine
          </span>
          <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Otomatisasi B3 Auto-Nota
          </span>
          <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Multi-Channel WA &amp; IG
          </span>
        </div>
      </div>

      {/* Asymmetric Bento Grid Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES_DATA.map((feat, idx) => {
          const IconComponent = ICON_MAP[feat.iconName] || Bot;
          const isLarge = idx === 0 || idx === 3;

          return (
            <motion.div
              key={feat.slug}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className={`group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_15px_30px_-15px_rgba(0,0,0,0.03)] hover:shadow-xl hover:border-sky-300 transition-all ${
                isLarge ? "lg:col-span-2" : ""
              }`}
            >
              <div className="space-y-4">
                {/* Header Badge & Icon */}
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-mono font-bold text-slate-700">
                    {feat.badge}
                  </span>
                </div>

                {/* Content */}
                <div>
                  <span className="text-[11px] font-mono font-bold text-sky-600 uppercase tracking-wider">
                    {feat.category}
                  </span>
                  <h3 className="font-display text-xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors mt-0.5">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {feat.tagline}
                  </p>
                </div>

                {/* Key Benefits Bullets */}
                <ul className="space-y-1.5 pt-2">
                  {feat.keyBenefits.slice(0, 2).map((benefit, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer Action */}
              <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500">
                  {feat.stats.slice(0, 1).map((s, sIdx) => (
                    <span key={sIdx}>
                      {s.label}: <strong className="text-slate-900 font-bold">{s.value}</strong>
                    </span>
                  ))}
                </div>

                <Link
                  href={`/features/${feat.slug}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 active:scale-95 transition-all"
                >
                  <span>Pelajari Detail</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
