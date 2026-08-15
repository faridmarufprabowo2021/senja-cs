import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Calendar,
  Receipt,
  Eye,
  TrendingUp,
  Columns,
  Truck,
  Code2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  Layers,
  ArrowLeft,
  MessageSquare,
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

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feat = FEATURES_DATA.find((f) => f.slug === slug);

  if (!feat) {
    notFound();
  }

  const IconComponent = ICON_MAP[feat.iconName] || Bot;

  return (
    <div className="space-y-10">
      {/* Back Button */}
      <Link
        href="/features"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Kembali ke Katalog Fitur</span>
      </Link>

      {/* Feature Hero Section */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)] space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-600 text-white font-bold shadow-md">
            <IconComponent className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-mono font-bold text-sky-600 uppercase tracking-wider">
              {feat.category}
            </span>
            <h1 className="font-display text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              {feat.title}
            </h1>
          </div>
        </div>

        <p className="text-lg font-medium text-slate-800 leading-relaxed max-w-4xl">
          {feat.tagline}
        </p>

        <p className="text-sm text-slate-600 leading-relaxed max-w-4xl">
          {feat.description}
        </p>

        {/* Hero Actions & Stats */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://wa.me/6289680640009?text=Halo%20Senja%20CS%2C%20saya%20ingin%20coba%20demo%20fitur%20ini"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-sky-700 active:scale-[0.98] transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Coba Demo WhatsApp Sekarang</span>
            </a>

            <Link
              href="/features"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-all"
            >
              <span>Lihat Fitur Lainnya</span>
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-6">
            {feat.stats.map((s, idx) => (
              <div key={idx}>
                <div className="text-lg font-bold font-mono text-slate-900">{s.value}</div>
                <div className="text-[10px] text-slate-500 font-mono">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Benefits Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2>Keunggulan Kunci Fitur Ini</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feat.keyBenefits.map((benefit, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-start gap-3.5 hover:border-sky-300 transition-all"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-slate-700 leading-relaxed pt-1">
                {benefit}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works Step-by-Step */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_15px_30px_-15px_rgba(0,0,0,0.03)] space-y-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
          <Zap className="h-5 w-5 text-sky-600" />
          <h2>Cara Kerja &amp; Alur Otomatisasi</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {feat.howItWorks.map((step, idx) => (
            <div key={idx} className="relative space-y-3">
              <div className="inline-block font-mono text-2xl font-black text-sky-600 bg-sky-50 px-3 py-1 rounded-xl border border-sky-100">
                {step.step}
              </div>
              <h3 className="font-bold text-sm text-slate-900">{step.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
          <Layers className="h-5 w-5 text-indigo-600" />
          <h2>Contoh Penerapan Studi Kasus Bisnis</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {feat.useCases.map((uc, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3"
            >
              <div className="font-bold text-xs font-mono text-sky-600 bg-sky-50 px-3 py-1 rounded-lg inline-block">
                {uc.title}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Skenario Lapangan:</h4>
                <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{uc.scenario}</p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-emerald-700">Hasil &amp; Dampak Otomatisasi:</h4>
                <p className="text-xs text-emerald-900 font-medium leading-relaxed mt-0.5">{uc.outcome}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Interactive CTA Box */}
      <div className="rounded-3xl bg-slate-900 text-white p-8 md:p-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="font-display text-xl font-bold">Siap Mengimplementasikan Fitur Ini di Bisnis Anda?</h3>
          <p className="text-xs text-slate-400 max-w-xl">
            Aktifkan Senja CS sekarang juga dan rasakan peningkatan efisiensi operasional customer service 24/7.
          </p>
        </div>

        <a
          href="https://wa.me/6289680640009?text=Halo%20Senja%20CS%2C%20saya%20tertarik%20menggunakan%20fitur%20ini"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3.5 text-xs font-bold text-white hover:bg-sky-400 active:scale-95 transition-all shrink-0"
        >
          <span>Hubungi Tim Sales &amp; Demo</span>
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
