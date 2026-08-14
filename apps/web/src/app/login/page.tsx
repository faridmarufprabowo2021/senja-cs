"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { login } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("sari@warungsenja.id");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[var(--color-paper)] px-4">
      <div className="pointer-events-none absolute inset-0 paper-grain opacity-60" />
      <div className="pointer-events-none absolute -left-16 top-10 h-72 w-72 rounded-full bg-[color-mix(in_oklab,var(--color-accent)_14%,transparent)] blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-[color-mix(in_oklab,var(--color-sunset)_10%,transparent)] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-[28px] border border-[var(--color-line)] bg-white p-8 shadow-[0_24px_60px_-28px_rgba(20,24,22,0.25)]"
      >
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent)] font-display text-xl font-semibold text-white"
          >
            S
          </Link>
          <h1 className="font-display text-2xl font-medium tracking-tight">
            Masuk ke Senja CS
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            Inbox, bot, dan knowledge untuk toko Anda
          </p>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-xs text-[var(--color-sunset)]">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="mt-2 w-full" size="lg" disabled={loading}>
            {loading ? "Masuk..." : "Masuk"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
          Demo: sari@warungsenja.id / demo1234
          <br />
          <Link
            href="/onboarding"
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            Daftar UMKM
          </Link>
          {" · "}
          <Link href="/" className="hover:text-[var(--color-ink)]">
            Beranda
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
