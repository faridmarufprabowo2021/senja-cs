"use client";

import { useEffect, useState } from "react";
import { useRealtime } from "@/lib/use-realtime";

export function playAudioBellChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Frequency 1 (880Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.5);

    // Frequency 2 (1320Hz - E6) after 100ms
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1320, ctx.currentTime);
        gain2.gain.setValueAtTime(0.2, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.6);
      } catch {
        /* ignore */
      }
    }, 100);
  } catch {
    /* ignore */
  }
}

export function NotificationListener() {
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    // Request Desktop Notification Permission on initial mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }
  }, []);

  useRealtime((event, data: any) => {
    if (
      event === "message.created" ||
      event === "order.created" ||
      event === "notification.created"
    ) {
      // 1. Play Audio Bell Chime if sound is enabled
      playAudioBellChime();

      // 2. Fire Desktop Push Notification if window is in background / minimized
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        const title = data?.contactName
          ? `💬 Pesan Baru dari ${data.contactName}`
          : "💬 Pesan Customer Baru — Senja CS";

        const body = data?.text || data?.summary || "Ada pesan masuk baru di Inbox WhatsApp / Instagram.";

        new Notification(title, {
          body,
          icon: "/favicon.ico",
        });
      }
    }
  });

  return null;
}
