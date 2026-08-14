"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Clock, ShieldAlert, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { SubscriptionInfo } from "@cs/shared";
import { api } from "@/lib/api";
import { Sidebar } from "./sidebar";
import { NotificationListener } from "./NotificationListener";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    api<{ subscription: SubscriptionInfo }>("/subscription")
      .then((res) => setSub(res.subscription))
      .catch(() => setSub(null));
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--color-paper)]">
      <NotificationListener />
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-paper)]">
        <div className="pointer-events-none absolute inset-0 paper-grain opacity-40" />

        {/* Trial / Expired Top Banner */}
        {sub && sub.plan === "starter" ? (
          <div
            className={`z-20 flex flex-wrap items-center justify-between gap-2 px-6 py-2 text-xs font-medium ${
              sub.isExpired
                ? "bg-[var(--color-sunset)] text-white"
                : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {sub.isExpired ? (
                <ShieldAlert className="h-4 w-4 shrink-0" />
              ) : (
                <Clock className="h-4 w-4 shrink-0" />
              )}
              <span>
                {sub.isExpired
                  ? "Masa Trial Starter 3 Hari Telah Berakhir. Upgrade ke Pro untuk membuka kunci bot & fitur penuh."
                  : `Masa Trial Starter 3 Hari: Sisa ${sub.daysRemaining} hari ${sub.hoursRemaining} jam.`}
              </span>
            </div>
            <Link
              href="/settings/billing"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                sub.isExpired
                  ? "bg-white text-[var(--color-sunset)] hover:bg-slate-100"
                  : "bg-[var(--color-accent)] text-white hover:opacity-90"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Upgrade ke Pro
            </Link>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-full flex-1 overflow-auto"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
