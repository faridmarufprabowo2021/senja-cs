"use client";

import { useEffect, useState } from "react";
import { getSession } from "@/lib/api";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session?.token) {
      window.location.href = "/login";
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="paper-grain grid h-dvh place-items-center bg-[var(--color-paper)] p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-white shadow-sm">
            <span className="font-display text-xl font-bold text-[var(--color-accent)]">S</span>
            <span className="animate-breath absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[var(--color-accent)]" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-lg font-medium text-[var(--color-ink)]">Senja CS</span>
            <span className="text-xs text-[var(--color-muted)]">Memuat workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
