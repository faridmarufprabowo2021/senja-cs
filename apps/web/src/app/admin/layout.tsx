"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  LayoutDashboard,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Badge, Button } from "@/components/ui";

const NAV_ITEMS = [
  { href: "/admin", label: "Ringkasan MRR", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Kelola Toko UMKM", icon: Building2 },
  { href: "/admin/transactions", label: "Transaksi SaaS", icon: CreditCard },
  { href: "/admin/wa-monitor", label: "Server WA Monitor", icon: Radio },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGate>
      <div className="flex h-dvh flex-col overflow-hidden bg-[var(--color-paper)] text-[var(--color-ink)]">
        {/* Top Executive Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-line)] bg-white/90 px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-accent)] font-display text-lg font-bold text-white shadow-sm">
              S
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-semibold tracking-tight text-[var(--color-ink)]">
                  Senja CS Platform
                </span>
                <Badge tone="accent" className="font-bold uppercase tracking-wider text-[10px]">
                  <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                  SUPER ADMIN
                </Badge>
              </div>
              <p className="text-[11px] text-[var(--color-muted)]">
                Pusat Kendali Platform SaaS & Management Toko
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Toko
              </Button>
            </Link>
          </div>
        </header>

        {/* Admin Navigation Bar */}
        <div className="border-b border-[var(--color-line)] bg-[var(--color-paper-2)]/60 px-6">
          <nav className="flex items-center gap-2 overflow-x-auto py-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
                    isActive
                      ? "border border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold shadow-xs"
                      : "text-[var(--color-muted)] hover:bg-white hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content View */}
        <main className="relative flex-1 overflow-auto bg-[var(--color-paper)] p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0 paper-grain opacity-40" />
          <div className="relative z-10 mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}
