"use client";

import { useGSAP } from "@gsap/react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
} from "framer-motion";
import gsap from "gsap";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  Database,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Smile,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Button } from "@/components/ui";

export function LandingHero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [activeIllustrationTab, setActiveIllustrationTab] = useState<"chat" | "perf" | "sentiment">("chat");

  // Mouse Tracking Motion Values for Spotlight Glow & 3D Tilt
  const rawMouseX = useMotionValue(400);
  const rawMouseY = useMotionValue(300);

  const smoothMouseX = useSpring(rawMouseX, { stiffness: 120, damping: 20 });
  const smoothMouseY = useSpring(rawMouseY, { stiffness: 120, damping: 20 });

  // 3D Parallax Tilt Transforms
  const textTiltX = useTransform(smoothMouseX, [0, 1200], [-6, 6]);
  const textTiltY = useTransform(smoothMouseY, [0, 800], [4, -4]);

  const cardRotateY = useTransform(smoothMouseX, [0, 1200], [-4, 4]);
  const cardRotateX = useTransform(smoothMouseY, [0, 800], [4, -4]);

  // Scroll Exit Animation (Scale Down & Parallax Fade-out on Scroll Down)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.93]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.15]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    rawMouseX.set(e.clientX - rect.left);
    rawMouseY.set(e.clientY - rect.top);
  };

  useGSAP(
    () => {
      gsap.from(".gsap-hero-title", {
        y: 25,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });
      gsap.from(".gsap-hero-desc", {
        y: 20,
        opacity: 0,
        duration: 0.9,
        delay: 0.15,
        ease: "power3.out",
      });
      gsap.from(".gsap-hero-cta", {
        y: 20,
        opacity: 0,
        duration: 0.9,
        delay: 0.3,
        ease: "power3.out",
      });
    },
    { scope: heroRef },
  );

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      className="relative overflow-hidden bg-[#faf9f6] pt-16 pb-20 md:pt-24 md:pb-28 selection:bg-teal-500 selection:text-white"
    >
      {/* 1. CURSOR-FOLLOWING MOUSE SPOTLIGHT GLOW ORB */}
      <motion.div
        style={{
          left: smoothMouseX,
          top: smoothMouseY,
          transform: "translate(-50%, -50%)",
        }}
        className="pointer-events-none absolute h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-teal-400/30 via-emerald-400/25 to-cyan-400/30 blur-[110px] z-0 transition-opacity duration-300"
      />

      {/* 2. SQUARE GRID MESH PATTERN & ANIMATED BLOBS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Blob 1: Top Left Teal */}
        <motion.div
          animate={{
            y: [0, -25, 0],
            scale: [1, 1.1, 1],
            opacity: [0.35, 0.5, 0.35],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-10 left-[10%] h-[450px] w-[450px] rounded-full bg-teal-300/35 blur-[130px]"
        />

        {/* Blob 2: Top Right Emerald */}
        <motion.div
          animate={{
            y: [0, 30, 0],
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.45, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-20 right-[5%] h-[500px] w-[500px] rounded-full bg-emerald-300/30 blur-[140px]"
        />

        {/* CRISP SQUARE GRID MESH PATTERN (32px x 32px) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />
      </div>

      {/* 3. MAIN HERO CONTAINER WITH SCROLL EXIT PARALLAX */}
      <motion.div
        style={{
          scale: heroScale,
          opacity: heroOpacity,
          y: heroY,
        }}
        className="mx-auto max-w-7xl px-6 relative z-10"
      >
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* LEFT HERO TEXT & CTAs WITH MOUSE PARALLAX TILT */}
          <motion.div
            style={{
              x: textTiltX,
              y: textTiltY,
            }}
            className="space-y-6 lg:col-span-7"
          >
            {/* Top Micro Badge with Aura */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="inline-flex items-center gap-2 rounded-full border border-teal-300/80 bg-teal-50/90 px-3.5 py-1.5 text-xs font-semibold text-teal-800 shadow-sm backdrop-blur-md cursor-default"
            >
              <Sparkles className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
              <span>Senja CS — Platform Omnichannel CS &amp; Commerce AI</span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="gsap-hero-title text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
              Otomatisasi Customer Service &amp; Penjualan WhatsApp <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600">Tanpa Batas</span>.
            </h1>

            {/* Subheadline */}
            <p className="gsap-hero-desc text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Hubungkan nomor WhatsApp bisnis Anda, unggah knowledge base toko, dan biarkan AI memproses order, reservasi booking, serta pembayaran QRIS secara otomatis 24/7.
            </p>

            {/* High-Contrast Interactive CTA Buttons */}
            <div className="gsap-hero-cta flex flex-wrap items-center gap-4 pt-2">
              <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link href="/login">
                  <Button size="lg" className="h-12 px-8 bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-xl shadow-teal-600/30 transition-all">
                    Mulai Sekarang — Gratis <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.98 }}>
                <a href="#demo">
                  <Button size="lg" variant="secondary" className="h-12 px-6 border border-slate-200 bg-white text-slate-800 font-semibold text-base shadow-sm hover:bg-slate-50 hover:border-slate-300">
                    Coba Simulasi AI <MessageCircle className="ml-2 h-5 w-5 text-teal-600" />
                  </Button>
                </a>
              </motion.div>
            </div>

            {/* Trust Highlights with Hover Pill Effects */}
            <div className="flex flex-wrap items-center gap-4 pt-6 text-xs text-slate-700 font-semibold border-t border-slate-200/80">
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-slate-200 shadow-2xs cursor-default transition-all"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Dual WA Engine (Baileys / Open-WA)</span>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-slate-200 shadow-2xs cursor-default transition-all"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>pgvector RAG &lt; 15ms</span>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-slate-200 shadow-2xs cursor-default transition-all"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>QRIS Midtrans &amp; Auto-Nota</span>
              </motion.div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: 3D PARALLAX INTERACTIVE ILLUSTRATION WIDGET */}
          <div className="lg:col-span-5 relative">
            {/* Orbiting Floating Badge 1 (Top Right) */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.08 }}
              className="absolute -top-6 -right-2 z-20 hidden sm:flex items-center gap-2 rounded-2xl border border-teal-200 bg-white/95 p-2.5 px-4 shadow-lg backdrop-blur-md text-xs font-bold text-teal-900 cursor-default"
            >
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </div>
              <span>🛡️ Open-WA Stealth VIP Active</span>
            </motion.div>

            {/* Orbiting Floating Badge 2 (Bottom Left) */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.08 }}
              className="absolute -bottom-6 -left-4 z-20 hidden sm:flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white/95 p-2.5 px-4 shadow-lg backdrop-blur-md text-xs font-bold text-emerald-900 cursor-default"
            >
              <Receipt className="h-4 w-4 text-emerald-600" />
              <span>🧾 Auto-Nota PDF Terkirim</span>
            </motion.div>

            {/* Main Interactive Parallax Phone Container with 3D Tilt */}
            <motion.div
              style={{
                rotateY: cardRotateY,
                rotateX: cardRotateX,
              }}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.015 }}
              className="relative mx-auto max-w-md rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xl shadow-slate-200/90 transition-all"
            >
              {/* Header Phone Bar with Tab Switcher */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl bg-teal-600 text-white font-bold shadow-md shadow-teal-600/20">
                    CS
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Senja CS AI Suite</div>
                    <div className="text-[11px] text-teal-700 font-semibold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" /> Interactive Simulator
                    </div>
                  </div>
                </div>

                {/* Tab Switcher Buttons */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-[11px] font-bold text-slate-600">
                  <button
                    onClick={() => setActiveIllustrationTab("chat")}
                    className={`rounded-lg px-2.5 py-1 transition-all ${
                      activeIllustrationTab === "chat" ? "bg-white text-teal-700 shadow-xs" : "hover:text-slate-900"
                    }`}
                  >
                    💬 Chat
                  </button>
                  <button
                    onClick={() => setActiveIllustrationTab("perf")}
                    className={`rounded-lg px-2.5 py-1 transition-all ${
                      activeIllustrationTab === "perf" ? "bg-white text-teal-700 shadow-xs" : "hover:text-slate-900"
                    }`}
                  >
                    ⚡ Speed
                  </button>
                  <button
                    onClick={() => setActiveIllustrationTab("sentiment")}
                    className={`rounded-lg px-2.5 py-1 transition-all ${
                      activeIllustrationTab === "sentiment" ? "bg-white text-teal-700 shadow-xs" : "hover:text-slate-900"
                    }`}
                  >
                    📊 CSAT
                  </button>
                </div>
              </div>

              {/* Dynamic Tab Content Display */}
              <div className="py-4 text-xs min-h-[260px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {activeIllustrationTab === "chat" && (
                    <motion.div
                      key="tab-chat"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-3"
                    >
                      {/* Customer Message */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-teal-600 p-3 text-white shadow-sm font-medium">
                          Kak, mau reservasi scaling gigi besok jam 14.00 ya
                        </div>
                      </div>

                      {/* AI Response Card */}
                      <div className="flex justify-start">
                        <div className="max-w-[92%] rounded-2xl rounded-tl-none border border-slate-200/80 bg-slate-50 p-3 text-slate-700 shadow-sm space-y-2">
                          <p className="leading-relaxed">
                            Baik Kak! Reservasi <strong>Scaling Gigi</strong> besok <strong>Senin jam 14.00 WIB</strong> sudah kami jadwalkan bersama Drg. Anisa.
                          </p>
                          <div className="rounded-xl border border-teal-200 bg-teal-50/90 p-2.5 text-[11px] space-y-1">
                            <div className="font-bold text-teal-900 flex items-center justify-between">
                              <span>📌 Tagihan QRIS Midtrans</span>
                              <span className="text-[10px] bg-teal-200/80 text-teal-900 px-1.5 py-0.5 rounded font-bold">Auto</span>
                            </div>
                            <div>Total Pembayaran: <strong>Rp 250.000</strong></div>
                            <div className="rounded bg-teal-600 p-1 text-center font-bold text-white mt-1 shadow-xs hover:bg-teal-700 transition-colors">
                              Scan QRIS Pembayaran
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Auto PDF Receipt */}
                      <div className="flex justify-start">
                        <div className="max-w-[92%] rounded-2xl rounded-tl-none border border-emerald-200 bg-emerald-50/90 p-2.5 text-emerald-950 shadow-sm">
                          <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                            <Receipt className="h-4 w-4 text-emerald-600" /> Lunas! Auto-Nota PDF Terkirim
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            Nota Resmi PDF #INV-2026-902 dikirim ke WhatsApp.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeIllustrationTab === "perf" && (
                    <motion.div
                      key="tab-perf"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-3.5 p-1"
                    >
                      <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-3 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-teal-900">
                          <span className="flex items-center gap-1.5"><Database className="h-4 w-4 text-teal-600" /> pgvector Similarity Search</span>
                          <span className="text-teal-700">14 ms</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-teal-200 overflow-hidden">
                          <div className="h-full w-[95%] bg-teal-600 rounded-full animate-pulse" />
                        </div>
                        <div className="text-[10px] text-teal-800">Pencarian konteks dokumen super cepat via index HNSW</div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                          <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-teal-600" /> RAM Server Baileys Socket</span>
                          <span className="text-emerald-700">~48 MB</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full w-[12%] bg-emerald-500 rounded-full" />
                        </div>
                        <div className="text-[10px] text-slate-600">Efisiensi memori ultra hemat untuk ratusan pesan paralel</div>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 px-3">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                          <Activity className="h-4 w-4 text-teal-600" /> Server Uptime SLA
                        </div>
                        <span className="font-extrabold text-emerald-600 text-xs">99.98%</span>
                      </div>
                    </motion.div>
                  )}

                  {activeIllustrationTab === "sentiment" && (
                    <motion.div
                      key="tab-sentiment"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-3.5 p-1"
                    >
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-center space-y-1">
                        <div className="text-xs font-bold text-emerald-900 uppercase">Skor Kepuasan Pelanggan (CSAT)</div>
                        <div className="text-3xl font-black text-emerald-700">98.4%</div>
                        <div className="text-[11px] text-emerald-800 font-medium">🟢 Sentimen Obrolan Sangat Puas</div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>Distribusi Sentimen LLM</span>
                          <span className="text-teal-700">Real-Time</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>🟢 Positif (Puas / Closing)</span>
                            <span className="font-bold text-slate-900">84%</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>⚪ Netral (Tanya Informasi)</span>
                            <span className="font-bold text-slate-900">14%</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <span>🔴 Komplain (Dialihkan Agen)</span>
                            <span className="font-bold text-slate-900">2%</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
