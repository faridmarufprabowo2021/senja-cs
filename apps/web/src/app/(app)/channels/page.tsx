"use client";

import { motion } from "framer-motion";
import { Plus, QrCode, RefreshCw, Smartphone, Unplug, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { WaSession } from "@cs/shared";
import { Badge, Button, Card, Input, PageHeader, StatusDot } from "@/components/ui";
import { api } from "@/lib/api";
import { isManager } from "@/lib/roles";
import { useRealtime } from "@/lib/use-realtime";

type SessionDetail = WaSession & { qr?: string | null };

export default function ChannelsPage() {
  const manager = isManager();
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [active, setActive] = useState<SessionDetail | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [engineChoice, setEngineChoice] = useState<"baileys" | "openwa">("baileys");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Custom Modal State for New WA Session
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState("");

  const refresh = useCallback(async () => {
    if (!manager) return;
    try {
      const list = await api<WaSession[]>("/wa/sessions");
      setSessions(list);
      setActive((prev) => {
        const keep =
          prev && list.some((s) => s.id === prev.id)
            ? list.find((s) => s.id === prev.id)!
            : (list[0] ?? null);
        return keep;
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat sesi");
    }
  }, [manager]);

  const loadQr = useCallback(async (sessionId: string) => {
    try {
      const detail = await api<SessionDetail>(`/wa/sessions/${sessionId}`);
      setActive(detail);
      if (detail.qr) setQr(detail.qr);
      else if (detail.status === "connected") setQr(null);
      return detail;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!manager || !active?.id) return;
    void loadQr(active.id);
  }, [manager, active?.id, loadQr]);

  // Poll QR while waiting (WS can miss first event)
  useEffect(() => {
    if (!manager || !active?.id) return;
    const waiting =
      active.status === "pending" ||
      active.status === "qr" ||
      (!!qr === false && active.status !== "connected");
    if (active.status === "connected" || active.status === "disconnected") {
      if (active.status === "connected") return;
      if (active.status === "disconnected" && !qr) return;
    }
    if (!waiting && !qr) return;
    const t = setInterval(() => {
      void loadQr(active.id);
    }, 1500);
    return () => clearInterval(t);
  }, [manager, active?.id, active?.status, qr, loadQr]);

  useRealtime((event, data) => {
    if (!manager) return;
    if (event === "wa.qr") {
      const d = data as { sessionId: string; qr: string; session?: WaSession };
      setQr(d.qr);
      if (d.session) setActive({ ...d.session, qr: d.qr });
      else if (d.sessionId)
        setActive((prev) =>
          prev?.id === d.sessionId
            ? { ...prev, status: "qr", qr: d.qr }
            : prev,
        );
    }
    if (event === "wa.status") {
      const d = data as { session?: WaSession; status: string; sessionId?: string };
      if (d.session) {
        setActive((prev) =>
          !prev || prev.id === d.session!.id
            ? { ...d.session!, qr: prev?.qr }
            : prev,
        );
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === d.session!.id);
          if (idx === -1) return [d.session!, ...prev];
          const next = [...prev];
          next[idx] = d.session!;
          return next;
        });
      }
      if (d.status === "connected") setQr(null);
      void refresh();
    }
  });

  useEffect(() => {
    if (active?.engine) {
      setEngineChoice(active.engine as "baileys" | "openwa");
    }
  }, [active?.engine]);

  async function selectSession(s: WaSession) {
    setQr(null);
    setActive(s);
    if (s.engine) setEngineChoice(s.engine as "baileys" | "openwa");
    await loadQr(s.id);
  }

  async function connect(opts?: { force?: boolean }) {
    setBusy(true);
    setError("");
    try {
      let sessionId = active?.id;
      if (sessionId) {
        const updated = await api<SessionDetail>(`/wa/sessions/${sessionId}/connect`, {
          method: "POST",
          body: JSON.stringify({
            force: opts?.force === true,
            engine: engineChoice,
          }),
        });
        if (updated.qr) setQr(updated.qr);
        setActive((prev) => ({ ...updated, qr: updated.qr || prev?.qr }));
      } else {
        const created = await api<SessionDetail>("/wa/sessions", {
          method: "POST",
          body: JSON.stringify({
            label: engineChoice === "openwa" ? "WhatsApp Open-WA VIP" : "WhatsApp Utama",
            engine: engineChoice,
          }),
        });
        sessionId = created.id;
        if (created.qr) setQr(created.qr);
        setActive(created);
      }
      await refresh();
      if (sessionId) {
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const d = await loadQr(sessionId);
          if (d?.qr || d?.status === "connected") break;
          if (
            d?.errorCode &&
            (d.errorCode.includes("openwa_offline") ||
              d.errorCode.includes("ECONNREFUSED") ||
              d.errorCode.includes("fetch failed"))
          ) {
            setError(
              `⚠️ Server Open-WA Daemon (port :8008) belum aktif di background. Silakan pilih engine "Baileys (Direct Socket)" di sebelah kiri, lalu klik Hubungkan untuk memunculkan QR secara instan!`,
            );
            break;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal connect");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateNewSession(e: React.FormEvent) {
    e.preventDefault();
    const label = newSessionLabel.trim();
    if (!label || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await api<SessionDetail>("/wa/sessions", {
        method: "POST",
        body: JSON.stringify({ label, engine: engineChoice }),
      });
      setActive(created);
      if (created.qr) setQr(created.qr);
      setIsAddModalOpen(false);
      setNewSessionLabel("");
      await refresh();
    } catch (err) {
      setError("Gagal membuat sesi WA baru");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      await api(`/wa/sessions/${active.id}/disconnect`, { method: "POST" });
      setQr(null);
      await refresh();
      await loadQr(active.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal disconnect");
    } finally {
      setBusy(false);
    }
  }

  const status = active?.status ?? "disconnected";
  const statusLabel =
    status === "connected"
      ? "Terhubung"
      : status === "qr"
        ? "Scan QR"
        : status === "pending"
          ? "Menyiapkan"
          : "Terputus";

  if (!manager) {
    return (
      <div className="p-8">
        <PageHeader
          title="WhatsApp"
          description="Hanya owner/admin yang bisa hubungkan nomor."
        />
        <p className="text-sm text-[var(--color-muted)]">
          Agent fokus balas chat di Inbox. Minta admin untuk scan QR.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="WhatsApp Multi-Session Management"
        description="Hubungkan dan kelola banyak nomor WhatsApp bisnis Anda dalam 1 dasbor terpadu."
      />

      {error ? (
        <p className="mb-4 text-sm text-[var(--color-danger)] font-semibold bg-rose-50 p-3 rounded-xl border border-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-5 border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white font-bold shadow-md">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="font-bold text-base text-slate-900">{active?.label ?? "Belum ada sesi"}</div>
              <div className="text-xs text-slate-500 font-mono">
                {active?.phone ?? "Belum terhubung"}
              </div>
            </div>
            <Badge
              className="ml-auto"
              tone={
                status === "connected"
                  ? "success"
                  : status === "qr" || status === "pending"
                    ? "warn"
                    : "danger"
              }
            >
              <StatusDot status={status} />
              {statusLabel}
            </Badge>
          </div>

          {sessions.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Daftar Sesi WA Terhubung:</span>
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 flex items-center gap-1">
                  🧠 Handled by General AI Agent
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void selectSession(s)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active?.id === s.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-2xs"
                        : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="mr-1.5 inline-block align-middle">
                      <StatusDot status={s.status} />
                    </span>
                    {s.label}
                    {s.phone ? ` · ${s.phone}` : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600 space-y-2">
            <div className="font-bold text-slate-800">Engine Socket WhatsApp:</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEngineChoice("baileys")}
                className={`flex-1 rounded-xl border p-3 text-left text-xs transition ${
                  engineChoice === "baileys"
                    ? "border-emerald-500 bg-white shadow-xs font-bold text-emerald-900"
                    : "border-slate-200 bg-white/50 text-slate-600"
                }`}
              >
                <div className="font-bold text-slate-900">⚡ Baileys (Direct Socket)</div>
                <div className="text-[11px] text-slate-500 font-normal">Hemat RAM, instan, standar.</div>
              </button>
              <button
                type="button"
                onClick={() => setEngineChoice("openwa")}
                className={`flex-1 rounded-xl border p-3 text-left text-xs transition ${
                  engineChoice === "openwa"
                    ? "border-emerald-500 bg-white shadow-xs font-bold text-emerald-900"
                    : "border-slate-200 bg-white/50 text-slate-600"
                }`}
              >
                <div className="font-bold text-slate-900">🛡️ Open-WA (Daemon)</div>
                <div className="text-[11px] text-slate-500 font-normal">Stealth anti-ban daemon.</div>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {status !== "connected" ? (
              <Button onClick={() => void connect()} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                <QrCode className="h-4 w-4 mr-1" />
                {busy ? "Menyiapkan..." : "Hubungkan"}
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={() => void disconnect()}
                disabled={busy}
              >
                <Unplug className="h-4 w-4 mr-1" />
                Putuskan Sesi Ini
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setNewSessionLabel("");
                setIsAddModalOpen(true);
              }}
              disabled={busy}
              className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-bold"
            >
              <Plus className="h-4 w-4 mr-1 text-emerald-600" />
              + Tambah Nomor WA Baru
            </Button>
            <Button variant="secondary" onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* QR Code Window */}
        <Card className="flex min-h-72 flex-col items-center justify-center p-6 border-slate-200 shadow-2xs">
          {qr ? (
            <motion.div
              key={qr.slice(0, 24)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="mx-auto mb-4 grid h-56 w-56 place-items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="WhatsApp QR"
                  className="h-full w-full object-contain"
                  src={
                    qr.startsWith("data:") || qr.startsWith("http")
                      ? qr
                      : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qr)}`
                  }
                />
              </div>
              <p className="text-sm font-bold text-slate-800">Scan QR di Aplikasi WhatsApp</p>
              <p className="mt-1 text-xs text-slate-500">
                Buka WhatsApp di HP → Perangkat tertaut → Tautkan perangkat
              </p>
            </motion.div>
          ) : status === "connected" ? (
            <div className="text-center space-y-2">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 font-bold">
                <Smartphone className="h-10 w-10" />
              </div>
              <p className="font-extrabold text-base text-slate-900">Sesi WhatsApp Terhubung!</p>
              <p className="text-xs font-mono text-slate-500">
                {active?.phone} ({active?.label})
              </p>
            </div>
          ) : status === "qr" || status === "pending" ? (
            <div className="text-center text-xs text-slate-500 font-medium space-y-2">
              <div>Menunggu QR Code dari Server...</div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400">
              Pilih atau buat sesi baru, lalu klik Hubungkan untuk memunculkan QR Code.
            </div>
          )}
        </Card>
      </div>

      {/* Premium Custom Dialog Modal Add WA Session */}
      {isAddModalOpen ? (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center font-bold">
                  <Smartphone className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">
                  Tambah Nomor WA Baru
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewSession} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Nama / Label Nomor WA *
                </label>
                <Input
                  type="text"
                  value={newSessionLabel}
                  onChange={(e) => setNewSessionLabel(e.target.value)}
                  placeholder="Contoh: WA Cabang Jakarta, WA Customer Support..."
                  autoFocus
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Label ini akan muncul sebagai penanda di Inbox dan Dasbor.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={!newSessionLabel.trim() || busy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {busy ? "Menyiapkan..." : "Buat Sesi & Scan QR"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
