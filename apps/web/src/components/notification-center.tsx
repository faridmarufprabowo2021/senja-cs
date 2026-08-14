"use client";

import { useRealtime } from "@/lib/use-realtime";
import { playChime } from "@/lib/audio-chime";
import { api } from "@/lib/api";
import {
  Bell,
  CheckCheck,
  CreditCard,
  MessageSquare,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type NotificationItem = {
  id: string;
  tenantId: string;
  type: "payment_received" | "ai_handover" | "system";
  title: string;
  message: string;
  link?: string;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
};

export function NotificationCenter({ align = "left" }: { align?: "left" | "right" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load initial notification list & sound preference
  const loadNotifications = async () => {
    try {
      const data = await api<{ items: NotificationItem[]; unreadCount: number }>("/notifications");
      setItems(data.items || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Ignore load error if unauthenticated
    }
  };

  useEffect(() => {
    void loadNotifications();
    const storedMute = localStorage.getItem("cs_sound_muted");
    if (storedMute === "true") setIsMuted(true);
  }, []);

  // Listen to Real-Time WebSocket Notifications
  useRealtime((event: string, data: unknown) => {
    if (event === "notification.created" && data) {
      const newItem = data as NotificationItem;

      setItems((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)].slice(0, 25));
      setUnreadCount((prev) => prev + 1);

      // Play Audio Alert if unmuted
      if (!isMuted) {
        if (newItem.type === "payment_received") {
          playChime("payment");
        } else {
          playChime("handover");
        }
      }
    }
  });

  // Toggle Sound Mute
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem("cs_sound_muted", String(next));
  };

  // Mark single item as read
  const markAsRead = async (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isRead: true } : i)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // Silent error
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    setUnreadCount(0);
    try {
      await api("/notifications/read-all", { method: "PATCH" });
    } catch {
      // Silent error
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-line)] bg-white text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none"
        title="Pusat Notifikasi Real-Time"
      >
        <Bell className="h-4 w-4" />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-md animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "left" ? "left-0" : "right-0"
          } mt-2.5 z-50 w-80 sm:w-96 rounded-2xl border border-[var(--color-line)] bg-white shadow-2xl overflow-hidden text-xs`}
        >
          {/* Dropdown Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-slate-50/80 p-3.5 px-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-teal-600" />
              <span className="font-bold text-[var(--color-text)]">Notifikasi Real-Time</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-[10px] font-bold">
                  {unreadCount} Baru
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Mute Sound Button */}
              <button
                onClick={toggleMute}
                className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-200/60"
                title={isMuted ? "Unmute Suara Notifikasi" : "Mute Suara Notifikasi"}
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-500" /> : <Volume2 className="h-4 w-4 text-teal-600" />}
              </button>

              {/* Mark All Read Button */}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800"
                  title="Tandai Semua Dibaca"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Dibaca
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="font-medium text-slate-600">Belum ada notifikasi</p>
                <p className="text-[11px] mt-0.5">Notifikasi pemasukan &amp; AI handover akan muncul otomatis di sini.</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => void markAsRead(item.id)}
                  className={`p-3.5 px-4 transition-colors cursor-pointer flex gap-3 items-start ${
                    !item.isRead ? "bg-teal-50/40 font-medium" : "hover:bg-slate-50 opacity-80"
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {item.type === "payment_received" ? (
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                        <CreditCard className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-700">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--color-text)] truncate">{item.title}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <p className="text-slate-600 leading-snug line-clamp-2">{item.message}</p>

                    {item.link && (
                      <Link
                        href={item.link}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                          void markAsRead(item.id);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline pt-1"
                      >
                        <MessageSquare className="h-3 w-3" /> Buka Detail &rarr;
                      </Link>
                    )}
                  </div>

                  {!item.isRead && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
