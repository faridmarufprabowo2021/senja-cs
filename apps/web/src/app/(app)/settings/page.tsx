"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Calendar } from "lucide-react";
import type { WorkspaceSettings, WorkspaceVertical } from "@cs/shared";
import { VERTICAL_LABEL } from "@cs/shared";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { api, getSession } from "@/lib/api";
import { isManager } from "@/lib/roles";

interface ReminderSettings {
  reminderEnabled: boolean;
  reminderWindowStartHours: number;
  reminderWindowEndHours: number;
  reminderTemplate: string;
}

export default function SettingsPage() {
  const manager = isManager();
  const session = getSession();
  const [ws, setWs] = useState<WorkspaceSettings | null>(null);
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<WorkspaceVertical>("commerce");
  const [payBank, setPayBank] = useState("");
  const [payAccount, setPayAccount] = useState("");
  const [payAccountName, setPayAccountName] = useState("");
  const [payNote, setPayNote] = useState("");
  
  // Custom Payment Gateway Midtrans milik Tenant
  const [midtransServerKey, setMidtransServerKey] = useState("");
  const [midtransClientKey, setMidtransClientKey] = useState("");
  const [midtransMerchantId, setMidtransMerchantId] = useState("");
  const [midtransIsProduction, setMidtransIsProduction] = useState(false);
  const [testingMidtrans, setTestingMidtrans] = useState(false);
  const [midtransTestMessage, setMidtransTestMessage] = useState("");
  
  // Reminder settings
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderWindowStartHours, setReminderWindowStartHours] = useState(30);
  const [reminderWindowEndHours, setReminderWindowEndHours] = useState(18);
  const [reminderTemplate, setReminderTemplate] = useState(
    "⏰ *Pengingat Jadwal Reservasi*\n\nHalo *{name}*,\nSekadar mengingatkan jadwal reservasi *{service}* Anda pada *{date}* besok.\n\n📌 *Catatan*: Mohon hadir 15 menit sebelum jam tindakan.\nJika ada perubahan jadwal, silakan balas chat ini ya. Terima kasih! 🙏"
  );
  
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<WorkspaceSettings>("/workspace")
        .then((w) => {
          setWs(w);
          setName(w.name);
          setVertical(w.vertical);
          setPayBank(w.payBank ?? "");
          setPayAccount(w.payAccount ?? "");
          setPayAccountName(w.payAccountName ?? "");
          setPayNote(w.payNote ?? "");
          setMidtransServerKey(w.midtransServerKey ?? "");
          setMidtransClientKey(w.midtransClientKey ?? "");
          setMidtransMerchantId(w.midtransMerchantId ?? "");
          setMidtransIsProduction(!!w.midtransIsProduction);
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Gagal memuat"),
        ),
      // Load reminder settings
      api<ReminderSettings>("/reminder-settings")
        .then((res: any) => {
          const rs = res?.data ?? res;
          if (rs) {
            setReminderEnabled(rs.reminderEnabled ?? true);
            setReminderWindowStartHours(rs.reminderWindowStartHours ?? 30);
            setReminderWindowEndHours(rs.reminderWindowEndHours ?? 18);
            if (rs.reminderTemplate) setReminderTemplate(rs.reminderTemplate);
          }
        })
        .catch(() => {
          /* ignore if endpoint not available */
        }),
    ])
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!manager) return;
    setError("");
    try {
      const next = await api<WorkspaceSettings>("/workspace", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          vertical,
          payBank: payBank.trim(),
          payAccount: payAccount.trim(),
          payAccountName: payAccountName.trim(),
          payNote: payNote.trim(),
          midtransServerKey: midtransServerKey.trim(),
          midtransClientKey: midtransClientKey.trim(),
          midtransMerchantId: midtransMerchantId.trim(),
          midtransIsProduction,
        }),
      });
      setWs(next);
      
      // Save reminder settings separately
      await api("/reminder-settings", {
        method: "PATCH",
        body: JSON.stringify({
          reminderEnabled,
          reminderWindowStartHours,
          reminderWindowEndHours,
          reminderTemplate,
        }),
      });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan");
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-[var(--color-muted)]">Memuat…</div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Pengaturan"
        description="Profil bisnis, cara bayar (rekening/QRIS), dan jenis usaha."
        action={
          <div className="flex items-center gap-2">
            <Link href="/settings/promos">
              <Button variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-bold">
                🎟️ Kelola Voucher Promo
              </Button>
            </Link>
            <Link href="/settings/invoice">
              <Button variant="secondary" className="bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 font-bold">
                🧾 Format Invoice & Nota
              </Button>
            </Link>
            <Link href="/settings/billing">
              <Button variant="secondary">
                <CreditCard className="h-4 w-4" />
                Langganan & Tagihan
              </Button>
            </Link>
            {manager ? (
              <Button onClick={() => void save()}>
                {saved ? "Tersimpan" : "Simpan"}
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-sm text-[var(--color-sunset)]">
          {error}
        </p>
      ) : null}

      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-medium">Bisnis</h2>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Nama UMKM
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!manager}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Slug
            </label>
            <Input value={ws?.slug ?? ""} disabled />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Plan Paket Aktif
              </label>
              <Link
                href="/settings/billing"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Atur Langganan / Upgrade Pro &rarr;
              </Link>
            </div>
            <Input value={(ws?.plan ?? "").toUpperCase()} disabled />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Jenis usaha (vertical)
            </label>
            <div className="flex flex-wrap gap-2">
              {(["commerce", "booking"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={!manager}
                  onClick={() => setVertical(v)}
                  className={`rounded-2xl border px-3 py-2 text-left text-xs transition ${
                    vertical === v
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] bg-white"
                  }`}
                >
                  <div className="font-medium">{VERTICAL_LABEL[v]}</div>
                  <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                    {v === "commerce"
                      ? "Katalog produk + order draft via WA"
                      : "Jadwal booking reservasi (Klinik / Service / Jasa)"}
                  </div>
                </button>
              ))}
            </div>
            {vertical === "booking" ? (
              <p className="mt-2 text-xs text-[var(--color-accent)] font-medium">
                Mode booking aktif: Bot AI otomatis menjawab jadwal/layanan & mencatat booking janji temu dari chat WA.
              </p>
            ) : (
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Mode commerce: Bot AI otomatis menjawab harga/stok & membuat pesanan draft dari chat WA.
              </p>
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-medium">Cara bayar (B1)</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Ditampilkan di invoice WA. Transfer manual — bukan payment gateway.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Bank
              </label>
              <Input
                value={payBank}
                onChange={(e) => setPayBank(e.target.value)}
                disabled={!manager}
                placeholder="BCA"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                No. rekening
              </label>
              <Input
                value={payAccount}
                onChange={(e) => setPayAccount(e.target.value)}
                disabled={!manager}
                placeholder="1234567890"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Atas nama
            </label>
            <Input
              value={payAccountName}
              onChange={(e) => setPayAccountName(e.target.value)}
              disabled={!manager}
              placeholder="Sari Warung Senja"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink)]">
              Catatan Khusus Usaha & Pembayaran (Tercetak di Invoice/Nota WA)
            </label>
            <textarea
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              disabled={!manager}
              rows={3}
              placeholder="Contoh Klinik: Mohon konfirmasi H-1 sebelum tindakan medik.&#10;Contoh Jasa: Garansi servis 30 hari sejak nota diterbitkan.&#10;Contoh Toko: Harga sudah termasuk PPN 11%."
              className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              Catatan ini akan otomatis tercetak di bagian bawah Invoice draf dan Nota Pelunasan Resmi (B3) yang dikirim ke WhatsApp pelanggan.
            </p>
          </div>
        </Card>

        {/* Payment Gateway Midtrans Settings */}
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-medium">Payment Gateway Akun Bisnis (Midtrans QRIS & E-Wallet)</h2>
            </div>
            <Badge tone={midtransServerKey ? "success" : "default"}>
              {midtransServerKey ? "Terhubung" : "Default System"}
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Hubungkan akun Midtrans bisnis Anda sendiri agar pembayaran QRIS, E-Wallet (GoPay/ShopeePay/Dana), dan Virtual Account pelanggan di WA <strong>100% langsung masuk ke rekening bank toko Anda</strong>.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Midtrans Server Key
              </label>
              <Input
                type="password"
                value={midtransServerKey}
                onChange={(e) => setMidtransServerKey(e.target.value)}
                disabled={!manager}
                placeholder="Mid-server-xxxx... atau SB-Mid-server-xxxx..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Midtrans Client Key
              </label>
              <Input
                value={midtransClientKey}
                onChange={(e) => setMidtransClientKey(e.target.value)}
                disabled={!manager}
                placeholder="Mid-client-xxxx... atau SB-Mid-client-xxxx..."
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Merchant ID (Opsional)
              </label>
              <Input
                value={midtransMerchantId}
                onChange={(e) => setMidtransMerchantId(e.target.value)}
                disabled={!manager}
                placeholder="M123456"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Mode Environment
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!manager}
                  onClick={() => setMidtransIsProduction(false)}
                  className={`flex-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    !midtransIsProduction
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
                  }`}
                >
                  🧪 Sandbox (Uji Coba)
                </button>
                <button
                  type="button"
                  disabled={!manager}
                  onClick={() => setMidtransIsProduction(true)}
                  className={`flex-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    midtransIsProduction
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
                  }`}
                >
                  🚀 Production (Live)
                </button>
              </div>
            </div>
          </div>

          {midtransTestMessage ? (
            <p className="text-xs font-semibold text-slate-700">{midtransTestMessage}</p>
          ) : null}

          {manager ? (
            <div className="pt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={testingMidtrans}
                onClick={async () => {
                  setTestingMidtrans(true);
                  setMidtransTestMessage("");
                  try {
                    const res = await api<{ ok: boolean; environment: string; error?: string }>(
                      "/settings/test-midtrans",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          midtransServerKey: midtransServerKey.trim() || undefined,
                          midtransIsProduction,
                        }),
                      },
                    );
                    if (res.ok) {
                      setMidtransTestMessage(`✅ Server Key Midtrans Valid! Terhubung ke mode ${res.environment.toUpperCase()}.`);
                    } else {
                      setMidtransTestMessage(`❌ ${res.error || "Gagal menguji kredensial Midtrans"}`);
                    }
                  } catch (err) {
                    setMidtransTestMessage(err instanceof Error ? `❌ ${err.message}` : "❌ Gagal tes koneksi");
                  } finally {
                    setTestingMidtrans(false);
                  }
                }}
                className="w-full text-xs font-extrabold border-slate-300 hover:bg-slate-50 text-slate-800"
              >
                {testingMidtrans ? "Menguji API Key..." : "⚡ Uji Koneksi API Key Midtrans (Ping Test)"}
              </Button>
            </div>
          ) : null}
        </Card>

        {manager ? (
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-medium">Reminder Booking H-1</h2>
            </div>
            
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between rounded-lg bg-[var(--color-paper-2)] px-4 py-3">
              <label className="text-sm font-medium text-[var(--color-ink)]">
                Aktifkan Pengingat Otomatis
              </label>
              <button
                type="button"
                onClick={() => setReminderEnabled(!reminderEnabled)}
                className={`relative h-6 w-11 rounded-full transition ${
                  reminderEnabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-line)]"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    reminderEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Window Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Kirim 30+ jam sebelum booking
                </label>
                <Input
                  type="number"
                  value={reminderWindowStartHours}
                  onChange={(e) => setReminderWindowStartHours(Number(e.target.value))}
                  disabled={!manager || !reminderEnabled}
                  min="1"
                  max="72"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Sampai 18+ jam sebelum booking
                </label>
                <Input
                  type="number"
                  value={reminderWindowEndHours}
                  onChange={(e) => setReminderWindowEndHours(Number(e.target.value))}
                  disabled={!manager || !reminderEnabled}
                  min="1"
                  max="72"
                />
              </div>
            </div>

            {/* Template Editor */}
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Template Pesan WhatsApp
              </label>
              <textarea
                rows={5}
                value={reminderTemplate}
                onChange={(e) => setReminderTemplate(e.target.value)}
                disabled={!manager || !reminderEnabled}
                placeholder="Gunakan placeholders: {{name}}, {{service}}, {{date}}"
                className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                Placeholders tersedia: {"{name}"} (nama pelanggan), {"{service}"} (layanan), {"{date}"} (tanggal booking)
              </p>
            </div>
          </Card>
        ) : null}

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-medium">Akun</h2>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Nama
            </label>
            <Input value={session?.user.name ?? ""} disabled />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Email
            </label>
            <Input value={session?.user.email ?? ""} disabled />
          </div>
          <Badge tone="accent">
            {session?.tenants.find((t) => t.id === session.tenantId)?.role ??
              "agent"}
          </Badge>
        </Card>
      </div>
    </div>
  );
}
