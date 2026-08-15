"use client";

import { useEffect, useState } from "react";
import { Bell, Bot, CheckCircle2, HelpCircle, MessageSquare, Send, Settings2, ShieldCheck, Sparkles, X } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/api";

type DailyReportSettings = {
  dailyReportEnabled: boolean;
  dailyReportTime: string;
  dailyReportChannel: "telegram" | "whatsapp" | "both";
  telegramBotToken: string;
  telegramChatId: string;
  ownerPhone: string;
};

export function DailyReportSettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<DailyReportSettings>({
    dailyReportEnabled: true,
    dailyReportTime: "21:00",
    dailyReportChannel: "telegram",
    telegramBotToken: "",
    telegramChatId: "",
    ownerPhone: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api<DailyReportSettings>("/analytics/daily-report/settings")
      .then((res) => {
        setSettings({
          dailyReportEnabled: res.dailyReportEnabled ?? true,
          dailyReportTime: res.dailyReportTime || "21:00",
          dailyReportChannel: (res.dailyReportChannel as any) || "telegram",
          telegramBotToken: res.telegramBotToken || "",
          telegramChatId: res.telegramChatId || "",
          ownerPhone: res.ownerPhone || "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const res = await api<{ ok: boolean; data: DailyReportSettings }>("/analytics/daily-report/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(res.data);
      setToast({ type: "success", msg: "Pengaturan Laporan Harian berhasil disimpan!" });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Gagal menyimpan pengaturan" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendNow() {
    setSendingNow(true);
    setToast(null);
    try {
      const res = await api<{ ok: boolean; message: string }>("/analytics/daily-report/send-now", {
        method: "POST",
      });
      setToast({ type: "success", msg: `🚀 Laporan Uji Coba Terkirim: ${res.message}` });
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Gagal menguji kirim laporan" });
    } finally {
      setSendingNow(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <Card className="w-full max-w-xl p-6 shadow-2xl max-h-[90dvh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-700 font-bold">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
                Otomasi Laporan Harian Telegram &amp; WA
                <Badge tone="accent">Fitur Eksekutif</Badge>
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Kirim ringkasan omset, total chat, booking, &amp; AI insights harian otomatis ke ponsel Owner/Manager.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="my-2 flex-1 overflow-y-auto space-y-4 pr-1">
          {toast && (
            <div
              className={`rounded-xl p-3 text-xs font-semibold flex items-center justify-between ${
                toast.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              <span>{toast.msg}</span>
              <button onClick={() => setToast(null)} className="font-bold">✕</button>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs text-[var(--color-muted)]">Memuat pengaturan laporan…</div>
          ) : (
            <>
              {/* Toggle Enable */}
              <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-1)] p-3.5">
                <div>
                  <h4 className="font-bold text-xs text-[var(--color-ink)]">Aktifkan Laporan Harian Otomatis</h4>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Laporan akan dikirim setiap hari sesuai jadwal waktu yang dipilih di bawah.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.dailyReportEnabled}
                  onChange={(e) => setSettings({ ...settings, dailyReportEnabled: e.target.checked })}
                  className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
              </div>

              {/* Time & Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                    Waktu Pengiriman Harian (WIB)
                  </label>
                  <select
                    value={settings.dailyReportTime}
                    onChange={(e) => setSettings({ ...settings, dailyReportTime: e.target.value })}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    <option value="18:00">18:00 WIB (Jam 6 Sore)</option>
                    <option value="19:00">19:00 WIB (Jam 7 Malam)</option>
                    <option value="20:00">20:00 WIB (Jam 8 Malam)</option>
                    <option value="21:00">21:00 WIB (Jam 9 Malam - Default)</option>
                    <option value="22:00">22:00 WIB (Jam 10 Malam)</option>
                    <option value="23:00">23:00 WIB (Jam 11 Malam)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                    Saluran Pengiriman
                  </label>
                  <select
                    value={settings.dailyReportChannel}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dailyReportChannel: e.target.value as any,
                      })
                    }
                    className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-xs font-medium focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    <option value="telegram">✈️ Telegram Bot API (Gratis &amp; Tercepat)</option>
                    <option value="whatsapp">💬 WhatsApp Owner</option>
                    <option value="both">🚀 Keduanya (Telegram &amp; WhatsApp)</option>
                  </select>
                </div>
              </div>

              {/* Telegram Config */}
              {(settings.dailyReportChannel === "telegram" || settings.dailyReportChannel === "both") && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-sky-950 flex items-center gap-1.5">
                      ✈️ Konfigurasi Telegram Bot API
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="text-[11px] font-bold text-sky-700 underline flex items-center gap-1"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      {showGuide ? "Sembunyikan Panduan" : "Panduan Buat Bot Telegram"}
                    </button>
                  </div>

                  {showGuide && (
                    <div className="rounded-xl bg-white p-3 text-[11px] text-slate-700 leading-relaxed space-y-1.5 border border-sky-200">
                      <p className="font-bold text-sky-900">Cara Buat Bot Telegram Gratis (3 Langkah):</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Buka aplikasi Telegram, cari akun <strong>@BotFather</strong>.</li>
                        <li>Ketik <code>/newbot</code>, beri nama bot Anda, lalu salin <strong>HTTP API Token</strong>-nya ke kotak di bawah.</li>
                        <li>Buka bot baru Anda, tekan Start. Untuk mengambil <strong>Chat ID</strong>, buka channel/bot atau gunakan <strong>@userinfobot</strong> di Telegram.</li>
                      </ol>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-sky-900">
                      Telegram Bot Token
                    </label>
                    <Input
                      value={settings.telegramBotToken}
                      onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                      placeholder="Cth: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="font-mono text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-sky-900">
                      Telegram Chat ID / Group ID
                    </label>
                    <Input
                      value={settings.telegramChatId}
                      onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                      placeholder="Cth: 987654321 atau -1001234567890 (Grup)"
                      className="font-mono text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {/* WhatsApp Config */}
              {(settings.dailyReportChannel === "whatsapp" || settings.dailyReportChannel === "both") && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                  <h4 className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                    💬 Konfigurasi WhatsApp Owner
                  </h4>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-emerald-900">
                      Nomor WhatsApp Owner / Manajer (Format 62)
                    </label>
                    <Input
                      value={settings.ownerPhone}
                      onChange={(e) => setSettings({ ...settings, ownerPhone: e.target.value })}
                      placeholder="Cth: 628123456789"
                      className="font-mono text-xs bg-white"
                    />
                    <p className="mt-1 text-[10px] text-emerald-700">
                      Laporan akan dikirim via sesi WhatsApp aktif toko ke nomor ini.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3">
          <Button
            type="button"
            variant="secondary"
            disabled={sendingNow || loading}
            onClick={() => void handleSendNow()}
            className="border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 font-bold text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 mr-1" />
            {sendingNow ? "Mengirim Laporan Uji Coba…" : "🚀 Kirim Laporan Uji Coba Sekarang"}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Tutup
            </Button>
            <Button disabled={saving || loading} onClick={() => void handleSave()}>
              {saving ? "Menyimpan…" : "Simpan Pengaturan"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
