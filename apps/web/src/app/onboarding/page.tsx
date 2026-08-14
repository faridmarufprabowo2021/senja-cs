"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { WaSession } from "@cs/shared";
import { Badge, Button, Card, Input, StatusDot, Textarea } from "@/components/ui";
import { api, getSession, register } from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";

const steps = ["Bisnis", "WhatsApp", "Knowledge", "Selesai"] as const;

const DEFAULT_FAQ = `Q: Jam buka?
A: Senin–Minggu 08.00–22.00

Q: Ada delivery?
A: Ya, radius 5km. Minimal order sesuai kebijakan toko.

Q: Cara bayar?
A: Tunai, QRIS, transfer, e-wallet.

Q: Hubungi agent?
A: Ketik "cs" atau "admin" untuk dihubungkan ke manusia.`;

type SessionDetail = WaSession & { qr?: string | null };

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [tenantName, setTenantName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");

  const [wa, setWa] = useState<SessionDetail | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [faq, setFaq] = useState(DEFAULT_FAQ);
  const [faqSeeded, setFaqSeeded] = useState(false);
  const [ready, setReady] = useState(false);

  const hasSession = Boolean(getSession()?.tenantId);

  const refreshWa = useCallback(async () => {
    if (!getSession()?.tenantId) return;
    try {
      const list = await api<WaSession[]>("/wa/sessions");
      const current = list[0] ?? null;
      if (!current) {
        setWa(null);
        setQr(null);
        return;
      }
      const detail = await api<SessionDetail>(`/wa/sessions/${current.id}`);
      setWa(detail);
      setQr(detail.qr ?? null);
    } catch {
      /* ignore until tenant ready */
    }
  }, []);

  useEffect(() => {
    if (step >= 1 && hasSession) void refreshWa();
  }, [step, hasSession, refreshWa]);

  useRealtime(
    (event, data) => {
      if (event === "wa.qr") {
        const d = data as { qr: string; session?: WaSession };
        setQr(d.qr);
        if (d.session) setWa({ ...d.session, qr: d.qr });
      }
      if (event === "wa.status") {
        const d = data as { session?: WaSession; status: string };
        if (d.session) setWa(d.session);
        if (d.status === "connected") setQr(null);
        void refreshWa();
      }
    },
    step >= 1 && hasSession,
  );

  async function createWorkspace() {
    setError("");
    if (!tenantName.trim() || !ownerName.trim() || !email.trim() || password.length < 6) {
      setError("Isi nama bisnis, nama Anda, email, dan password (min 6).");
      return;
    }

    const currentSession = getSession();
    if (currentSession?.token && currentSession?.user?.email?.toLowerCase() === email.trim().toLowerCase()) {
      setStep(1);
      return;
    }

    setBusy(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: ownerName.trim(),
        tenantName: tenantName.trim(),
      });

      const promptParts = [
        `Kamu CS WhatsApp ${tenantName.trim()}. Jawab singkat, ramah, Bahasa Indonesia.`,
        "Hanya gunakan konteks knowledge. Jika tidak tahu, tawarkan hubungi agent.",
      ];
      if (description.trim()) {
        promptParts.push(`Profil bisnis: ${description.trim()}`);
      }
      try {
        await api("/bot/settings", {
          method: "PATCH",
          body: JSON.stringify({
            enabled: true,
            systemPrompt: promptParts.join(" "),
          }),
        });
      } catch {
        /* bot settings optional on create — can set later */
      }
      setStep(1);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal mendaftar";
      const sessionAfter = getSession();
      if (
        (errMsg.includes("already registered") || errMsg.includes("already in use") || errMsg.includes("registered")) &&
        sessionAfter?.token
      ) {
        setStep(1);
      } else {
        setError(errMsg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function connectWa() {
    setBusy(true);
    setError("");
    try {
      if (wa) {
        await api(`/wa/sessions/${wa.id}/connect`, { method: "POST" });
      } else {
        await api<WaSession>("/wa/sessions", {
          method: "POST",
          body: JSON.stringify({ label: "Nomor utama" }),
        });
      }
      await refreshWa();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal hubungkan WA");
    } finally {
      setBusy(false);
    }
  }

  async function seedFaq() {
    setError("");
    if (!faq.trim()) {
      setError("Isi FAQ singkat dulu, atau lewati.");
      return;
    }
    setBusy(true);
    try {
      await api("/knowledge/documents", {
        method: "POST",
        body: JSON.stringify({
          title: `FAQ ${tenantName.trim() || "bisnis"}`,
          content: faq.trim(),
          sourceType: "faq",
        }),
      });
      setFaqSeeded(true);
      setStep(3);
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan knowledge");
    } finally {
      setBusy(false);
    }
  }

  function goDashboard() {
    window.location.href = "/dashboard";
  }

  async function next() {
    setError("");
    if (step === 0) {
      await createWorkspace();
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (faqSeeded) {
        setStep(3);
        setReady(true);
        return;
      }
      await seedFaq();
      return;
    }
    goDashboard();
  }

  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  const waStatus = wa?.status ?? "disconnected";
  const canSkipWa = step === 1;
  const canSkipFaq = step === 2;

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Setup workspace</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Daftar tenant · hubungkan WA · seed FAQ
          </p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${
                  i <= step
                    ? "bg-[var(--color-accent)] text-[#06241b]"
                    : "bg-[var(--color-paper-2)] text-[var(--color-muted)]"
                }`}
              >
                {i + 1}
              </div>
              <span className="hidden text-xs text-[var(--color-muted)] sm:inline">
                {s}
              </span>
              {i < steps.length - 1 ? (
                <div className="h-px w-6 bg-[var(--color-line)] sm:w-10" />
              ) : null}
            </div>
          ))}
        </div>

        <Card className="overflow-hidden p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {step === 0 ? (
                <>
                  <h2 className="font-medium">Profil bisnis</h2>
                  <div>
                    <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                      Nama UMKM
                    </label>
                    <Input
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="Warung Kopi Senja"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                      Nama Anda
                    </label>
                    <Input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Sari"
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="anda@toko.id"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                        Password
                      </label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="min. 6 karakter"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                      Deskripsi singkat
                    </label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Kedai kopi specialty + catering coffee break."
                      rows={3}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-faint)]">
                    Sudah punya akun?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-[var(--color-accent)] hover:underline"
                    >
                      Masuk
                    </Link>
                  </p>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-medium">Hubungkan WhatsApp</h2>
                    <Badge
                      tone={
                        waStatus === "connected"
                          ? "success"
                          : waStatus === "qr" || waStatus === "pending"
                            ? "warn"
                            : "default"
                      }
                    >
                      <StatusDot status={waStatus} />
                      {waStatus}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--color-muted)]">
                    Scan QR dengan WhatsApp → Perangkat tertaut. Bisa dilewati dan
                    dihubungkan nanti di menu Channels.
                  </p>
                  <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-paper-2)] p-4">
                    {qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          qr.startsWith("data:")
                            ? qr
                            : `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qr)}`
                        }
                        alt="QR WhatsApp"
                        className="h-44 w-44 rounded-xl bg-white p-2"
                      />
                    ) : waStatus === "connected" ? (
                      <p className="text-sm text-[var(--color-accent)]">
                        Terhubung{wa?.phone ? ` · ${wa.phone}` : ""}
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--color-faint)]">
                        Klik Hubungkan untuk menampilkan QR
                      </p>
                    )}
                  </div>
                  {waStatus !== "connected" ? (
                    <Button onClick={() => void connectWa()} disabled={busy}>
                      {busy ? "Menyiapkan..." : "Hubungkan WhatsApp"}
                    </Button>
                  ) : null}
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <h2 className="font-medium">Knowledge awal</h2>
                  <p className="text-sm text-[var(--color-muted)]">
                    Paste FAQ singkat — di-chunk & di-embed untuk bot RAG.
                  </p>
                  <Textarea
                    rows={8}
                    value={faq}
                    onChange={(e) => setFaq(e.target.value)}
                  />
                </>
              ) : null}

              {step === 3 ? (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[color-mix(in_oklab,var(--color-accent)_20%,transparent)] text-2xl">
                    ✓
                  </div>
                  <h2 className="text-lg font-medium">
                    {tenantName || "Workspace"} siap
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {ready
                      ? "Tenant, bot, dan knowledge siap. Lanjut ke dashboard."
                      : "Setup selesai. Anda bisa lengkapi WA & knowledge kapan saja."}
                  </p>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {error ? (
            <p className="mt-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-xs text-[var(--color-sunset)]">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={back}>
              Kembali
            </Button>
            <div className="flex flex-wrap gap-2">
              {canSkipWa ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setStep(2);
                  }}
                >
                  Lewati
                </Button>
              ) : null}
              {canSkipFaq ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setStep(3);
                    setReady(true);
                  }}
                >
                  Lewati
                </Button>
              ) : null}
              <Button onClick={() => void next()} disabled={busy}>
                {busy
                  ? "Memproses..."
                  : step === steps.length - 1
                    ? "Masuk dashboard"
                    : step === 0
                      ? (hasSession ? "Lanjut ke WhatsApp" : "Buat workspace")
                      : step === 2
                        ? "Simpan FAQ"
                        : "Lanjut"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
