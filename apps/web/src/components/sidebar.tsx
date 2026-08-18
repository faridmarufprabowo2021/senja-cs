"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  ClipboardList,
  GitBranch,
  Inbox,
  Instagram,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  PanelLeftClose,
  Settings,
  Smartphone,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { WaSession } from "@cs/shared";
import { api, getSession, setSession } from "@/lib/api";
import { canAccessPath, isManager } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { StatusDot } from "./ui";
import { NotificationCenter } from "./notification-center";

type NavGroup = {
  section?: string;
  items: Array<{
    href: string;
    label: string;
    icon: any;
    managerOnly?: boolean;
  }>;
};

const navGroups: NavGroup[] = [
  {
    section: "Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/analytics", label: "Analytics AI", icon: BarChart3, managerOnly: true },
    ],
  },
  {
    section: "Operasional",
    items: [
      { href: "/contacts", label: "Kontak", icon: Users },
      { href: "/pipeline", label: "Pipeline CRM", icon: GitBranch },
      { href: "/orders", label: "Pesanan", icon: ClipboardList },
      { href: "/bookings", label: "Booking", icon: Calendar },
      { href: "/shipping", label: "Cek Resi & Ongkir", icon: Truck },
      { href: "/campaigns", label: "Broadcast WA", icon: Megaphone, managerOnly: true },
    ],
  },
  {
    section: "Otomatisasi & AI",
    items: [
      { href: "/analytics/copilot", label: "CRM Analis by AI", icon: Sparkles, managerOnly: true },
      { href: "/catalog", label: "Katalog Produk", icon: Package, managerOnly: true },
      { href: "/knowledge", label: "Knowledge Base", icon: BookOpen, managerOnly: true },
      { href: "/bot", label: "Bot AI RAG", icon: Bot, managerOnly: true },
      { href: "/settings/flows", label: "WhatsApp Auto-Flow", icon: GitBranch, managerOnly: true },
      { href: "/settings/instagram-rules", label: "Auto DM Instagram", icon: Instagram, managerOnly: true },
      { href: "/reminders", label: "Pengingat WA", icon: Bell, managerOnly: true },
    ],
  },
  {
    section: "Pengaturan",
    items: [
      { href: "/settings/channels", label: "Koneksi IG & WA", icon: Smartphone, managerOnly: true },
      { href: "/team", label: "Tim CS", icon: Users, managerOnly: true },
      { href: "/settings", label: "Pengaturan", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState("User");
  const [tenantName, setTenantName] = useState("Workspace");
  const [role, setRole] = useState("agent");
  const [waStatus, setWaStatus] = useState<WaSession["status"]>("disconnected");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cs_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("cs_sidebar_collapsed", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUserName(session.user.name);
      const tenant =
        session.tenants.find((t) => t.id === session.tenantId) ??
        session.tenants[0];
      if (tenant) {
        setTenantName(tenant.name);
        setRole(tenant.role || "agent");
      }
    }
  }, []);

  useEffect(() => {
    const loadWAStatus = async () => {
      try {
        const sessions = await api<WaSession[]>("/wa/sessions");
        const connected = sessions.find((s) => s.status === "connected");
        setWaStatus(connected?.status || "disconnected");
      } catch {
        // ignore
      }
    };
    void loadWAStatus();
  }, []);

  const isAdmin = role === "owner" || role === "admin";

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative h-dvh border-r border-[var(--color-line)] bg-[var(--color-paper)] flex flex-col z-30 shrink-0 select-none"
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--color-line)] h-14 bg-white/50 backdrop-blur-xs">
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden group">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold grid place-items-center text-sm shadow-sm group-hover:scale-105 transition-transform">
              S
            </div>
            <div className="overflow-hidden">
              <span className="font-display text-base font-bold text-[var(--color-ink)] truncate block leading-tight">
                Senja CS
              </span>
              <span className="text-[10px] text-[var(--color-muted)] truncate block">
                {tenantName}
              </span>
            </div>
          </Link>
        ) : (
          <div className="mx-auto h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold grid place-items-center text-sm shadow-sm">
            S
          </div>
        )}

        <div className="flex items-center gap-1">
          <NotificationCenter align="left" />
          <button
            onClick={toggleCollapse}
            className="p-1.5 hover:bg-[var(--color-paper-2)] rounded-lg transition-colors text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            title={collapsed ? "Buka Sidebar" : "Tutup Sidebar"}
          >
            <PanelLeftClose className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Navigation Links with Categorized Headers */}
      <nav className="flex-1 p-2.5 overflow-y-auto space-y-4">
        {navGroups.map((group, gIdx) => {
          const visibleItems = group.items.filter((item) => (item.managerOnly ? isAdmin : true));
          if (visibleItems.length === 0) return null;

          return (
            <div key={gIdx} className="space-y-1">
              {!collapsed && group.section && (
                <p className="px-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1.5 opacity-75">
                  {group.section}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative font-medium text-xs",
                          isActive
                            ? "bg-[var(--color-accent)] text-white shadow-xs font-semibold"
                            : "text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]",
                          collapsed && "justify-center px-2"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                            isActive ? "text-white" : "text-[var(--color-muted)] group-hover:text-[var(--color-ink)]"
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {isActive && !collapsed && (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/40 rounded-l-full" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* WhatsApp Status Pill */}
      {!collapsed && (
        <div className="px-3 py-2 mx-2.5 mb-2 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", waStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-rose-400")} />
            <span className="font-semibold text-emerald-900 text-[11px]">
              WA: {waStatus === "connected" ? "Terhubung" : "Terputus"}
            </span>
          </div>
          <Link href="/channels" className="text-[10px] font-bold text-emerald-700 hover:underline">
            Kelola
          </Link>
        </div>
      )}

      {/* User Info & Logout Footer */}
      <div className="border-t border-[var(--color-line)] p-2.5 bg-white/40">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="relative shrink-0">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-xs shadow-2xs">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
                waStatus === "connected" ? "bg-emerald-500" : "bg-slate-400"
              )}
            />
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-[var(--color-ink)] truncate leading-tight">
                {userName}
              </p>
              <p className="text-[10px] text-[var(--color-muted)] truncate capitalize">
                {role} · {tenantName}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => {
                setSession(null);
                window.location.href = "/login";
              }}
              className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors text-slate-400 hover:text-rose-600"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
