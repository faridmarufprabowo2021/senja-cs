"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  MessageSquare,
  Sparkles,
  Zap,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card } from "@/components/ui";

type ReminderRule = {
  id: string;
  name: string;
  triggerType: "UNPAID_INVOICE" | "BOOKING_SCHEDULE" | "CUSTOM_FOLLOWUP";
  delayMinutes: number;
  messageTemplate: string;
  isActive: boolean;
  createdAt: string;
};

type ReminderLog = {
  id: string;
  recipientName: string;
  phone: string;
  message: string;
  status: "SENT" | "PENDING" | "FAILED";
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
};

export default function RemindersPage() {
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<"UNPAID_INVOICE" | "BOOKING_SCHEDULE" | "CUSTOM_FOLLOWUP">("UNPAID_INVOICE");
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [messageTemplate, setMessageTemplate] = useState(
    "Halo {{customerName}}, pengingat untuk invoice {{invoiceNumber}} sebesar {{amount}} belum terbayar. Silakan klik link QRIS berikut untuk pelunasan instan: {{qrisUrl}}. Terima kasih!",
  );
  const [saving, setSaving] = useState(false);

  // Test WA Send State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testRuleId, setTestRuleId] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testSuccessMsg, setTestSuccessMsg] = useState<string | null>(null);
  const [testErrorMsg, setTestErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api<{ ok: boolean; rules: ReminderRule[]; logs: ReminderLog[] }>("/reminders");
      if (res.ok) {
        setRules(res.rules || []);
        setLogs(res.logs || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openNewRuleModal = () => {
    setEditingRuleId(null);
    setName("Pengingat Invoice Belum Lunas");
    setTriggerType("UNPAID_INVOICE");
    setDelayMinutes(60);
    setMessageTemplate(
      "Halo {{customerName}}, pengingat untuk invoice {{invoiceNumber}} sebesar {{amount}} belum terbayar. Silakan bayar melalui link berikut: {{qrisUrl}}. Jatuh tempo: {{dueDate}}.",
    );
    setShowRuleModal(true);
  };

  const openPresetModal = (preset: "unpaid" | "booking" | "followup") => {
    setEditingRuleId(null);
    if (preset === "unpaid") {
      setName("Pengingat Automatic Invoice (60 Menit)");
      setTriggerType("UNPAID_INVOICE");
      setDelayMinutes(60);
      setMessageTemplate(
        "Halo {{customerName}}, pesanan Anda dengan invoice {{invoiceNumber}} sebesar {{amount}} belum dilunasi. Yuk tuntaskan pembayaran melalui QRIS instan berikut: {{qrisUrl}}.",
      );
    } else if (preset === "booking") {
      setName("Pengingat H-1 Jadwal Booking/Servis");
      setTriggerType("BOOKING_SCHEDULE");
      setDelayMinutes(1440); // 24 hours
      setMessageTemplate(
        "Halo {{customerName}}, kami mengingatkan jadwal reservasi/booking Anda pada {{dueDate}}. Harap hadir 10 menit lebih awal. Sampai jumpa!",
      );
    } else {
      setName("Follow-up Kepuasan Pelanggan");
      setTriggerType("CUSTOM_FOLLOWUP");
      setDelayMinutes(180);
      setMessageTemplate(
        "Halo {{customerName}}, terima kasih telah berbelanja di tempat kami! Bagaimana pengalaman Anda? Jika ada masukan, cukup balas pesan ini ya!",
      );
    }
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !messageTemplate.trim()) return;

    try {
      setSaving(true);
      if (editingRuleId) {
        await api(`/reminders/${editingRuleId}`, {
          method: "PUT",
          body: JSON.stringify({ name, triggerType, delayMinutes, messageTemplate }),
        });
      } else {
        await api("/reminders", {
          method: "POST",
          body: JSON.stringify({ name, triggerType, delayMinutes, messageTemplate, isActive: true }),
        });
      }
      setShowRuleModal(false);
      void loadData();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: ReminderRule) => {
    try {
      await api(`/reminders/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      void loadData();
    } catch {
      /* ignore */
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus aturan pengingat ini?")) return;
    try {
      await api(`/reminders/${id}`, { method: "DELETE" });
      void loadData();
    } catch {
      /* ignore */
    }
  };

  const openTestModal = (ruleId: string) => {
    setTestRuleId(ruleId);
    setTestPhone("");
    setTestSuccessMsg(null);
    setTestErrorMsg(null);
    setShowTestModal(true);
  };

  const handleSendTestWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testRuleId || testing) return;

    try {
      setTesting(true);
      setTestSuccessMsg(null);
      setTestErrorMsg(null);

      const res = await api<{ ok: boolean; message: string }>(`/reminders/${testRuleId}/test`, {
        method: "POST",
        body: JSON.stringify({ phone: testPhone }),
      });

      if (res.ok) {
        setTestSuccessMsg(res.message || "Pesan WA pengingat berhasil dikirim!");
        void loadData();
      }
    } catch (err: any) {
      setTestErrorMsg(err?.message || "Gagal mengirim WA. Pastikan sesi WhatsApp terhubung di menu WhatsApp.");
    } finally {
      setTesting(false);
    }
  };

  const insertVariable = (varCode: string) => {
    setMessageTemplate((prev) => `${prev} ${varCode}`);
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink)] flex items-center gap-2">
            <Bell className="h-6 w-6 text-[var(--color-accent)]" /> Pengingat WhatsApp Otomatis
          </h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Kirim pengingat tagihan invoice, jadwal reservasi booking, dan pesan follow-up otomatis ke WhatsApp pelanggan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={openNewRuleModal}>
            <Plus className="mr-2 h-4 w-4" /> Buat Aturan Pengingat
          </Button>
        </div>
      </header>

      {/* Preset Rules Recommendation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => openPresetModal("unpaid")}
          className="group relative cursor-pointer rounded-2xl border-2 border-emerald-500/20 bg-white p-4 transition-all hover:border-emerald-500 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--color-ink)] group-hover:text-emerald-700">
                Pengingat Tagihan Invoice (B1/B2)
              </h4>
              <p className="text-xs text-[var(--color-muted)]">Otomatis ingatkan invoice belum lunas.</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => openPresetModal("booking")}
          className="group relative cursor-pointer rounded-2xl border-2 border-sky-500/20 bg-white p-4 transition-all hover:border-sky-500 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--color-ink)] group-hover:text-sky-700">
                Pengingat H-1 Jadwal Booking
              </h4>
              <p className="text-xs text-[var(--color-muted)]">Cegah pelanggan lupa jadwal reservasi.</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => openPresetModal("followup")}
          className="group relative cursor-pointer rounded-2xl border-2 border-amber-500/20 bg-white p-4 transition-all hover:border-amber-500 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--color-ink)] group-hover:text-amber-700">
                Follow-up Kepuasan Pelanggan
              </h4>
              <p className="text-xs text-[var(--color-muted)]">Tanyakan kepuasan & testimoni.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <section className="space-y-4">
        <h3 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--color-accent)]" /> Aturan Pengingat Aktif ({rules.length})
        </h3>

        {loading ? (
          <div className="grid h-36 place-items-center rounded-2xl border border-[var(--color-line)] bg-white">
            <Sparkles className="h-6 w-6 animate-spin text-[var(--color-accent)]" />
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] p-8 text-center">
            <Bell className="mx-auto h-10 w-10 text-[var(--color-muted)] mb-2" />
            <h4 className="text-sm font-bold text-[var(--color-ink)]">Belum Ada Aturan Pengingat</h4>
            <p className="text-xs text-[var(--color-muted)] mt-1 mb-4">
              Buat aturan pengingat otomatis pertama Anda untuk mulai mengirim pesan penagihan ke WhatsApp pelanggan.
            </p>
            <Button onClick={openNewRuleModal}>
              <Plus className="mr-2 h-4 w-4" /> Buat Aturan Pengingat
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <Card key={rule.id} className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Clock className="h-3.5 w-3.5" /> Interval: {rule.delayMinutes} Menit
                    </span>

                    <button
                      onClick={() => void handleToggleActive(rule)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        rule.isActive ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          rule.isActive ? "translate-x-5" : "translate-x-0.5"
                        } mt-0.5`}
                      />
                    </button>
                  </div>

                  <h4 className="text-base font-bold text-[var(--color-ink)]">{rule.name}</h4>
                  <p className="text-xs text-[var(--color-muted)] line-clamp-3 bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-line)] font-mono">
                    "{rule.messageTemplate}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[var(--color-line)]">
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>

                  <Button size="sm" variant="secondary" onClick={() => openTestModal(rule.id)}>
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Uji Coba Kirim WA
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Reminder Execution Logs Table */}
      <section className="space-y-4 pt-4">
        <h3 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
          <Clock className="h-5 w-5 text-[var(--color-accent)]" /> Riwayat Pengiriman WA Pengingat
        </h3>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-paper-2)] text-[var(--color-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Penerima</th>
                  <th className="px-4 py-3">Nomor WA</th>
                  <th className="px-4 py-3">Isi Pesan WA</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-muted)]">
                      Belum ada riwayat pengiriman pengingat.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--color-paper-2)]/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-[var(--color-ink)]">{log.recipientName}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)] font-mono">{log.phone}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-[var(--color-ink)]" title={log.message}>
                        {log.message}
                      </td>
                      <td className="px-4 py-3">
                        {log.status === "SENT" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Tersampaikan
                          </span>
                        ) : log.status === "FAILED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200" title={log.errorMessage || "Gagal"}>
                            <AlertCircle className="h-3 w-3 text-rose-600" /> Gagal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3 text-amber-600" /> Menunggu
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {new Date(log.createdAt).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Modal Builder Aturan Pengingat */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[var(--color-line)]">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-base font-bold text-[var(--color-ink)]">
                {editingRuleId ? "Edit Aturan Pengingat" : "Buat Aturan Pengingat WA"}
              </h3>
              <button
                onClick={() => setShowRuleModal(false)}
                className="text-xs text-[var(--color-muted)] hover:text-black font-bold"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveRule(e)} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--color-ink-soft)] font-semibold mb-1">Nama Aturan</label>
                <input
                  type="text"
                  placeholder="Misal: Pengingat Tagihan Invoice 1 Jam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--color-ink-soft)] font-semibold mb-1">Pemicu Pengingat</label>
                  <select
                    value={triggerType}
                    onChange={(e: any) => setTriggerType(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                  >
                    <option value="UNPAID_INVOICE">Invoice Belum Lunas (B1/B2)</option>
                    <option value="BOOKING_SCHEDULE">Jadwal Booking / Reservasi</option>
                    <option value="CUSTOM_FOLLOWUP">Follow-up Kepuasan Pelanggan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--color-ink-soft)] font-semibold mb-1">Interval (Menit)</label>
                  <input
                    type="number"
                    min={1}
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[var(--color-ink-soft)] font-semibold">Template Pesan WhatsApp</label>
                  <span className="text-[11px] text-[var(--color-muted)]">Klik chip untuk menyisipkan variabel:</span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => insertVariable("{{customerName}}")}
                    className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    + {"{{customerName}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable("{{invoiceNumber}}")}
                    className="rounded-lg bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100"
                  >
                    + {"{{invoiceNumber}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable("{{amount}}")}
                    className="rounded-lg bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700 hover:bg-purple-100"
                  >
                    + {"{{amount}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable("{{qrisUrl}}")}
                    className="rounded-lg bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-bold text-teal-700 hover:bg-teal-100"
                  >
                    + {"{{qrisUrl}}"}
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] font-sans leading-relaxed"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-line)]">
                <Button variant="secondary" type="button" onClick={() => setShowRuleModal(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan Aturan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Uji Coba Kirim WA */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-[var(--color-line)]">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Send className="h-4 w-4 text-[var(--color-accent)]" /> Uji Coba Pengiriman WA Pengingat
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-xs text-[var(--color-muted)] hover:text-black font-bold"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={(e) => void handleSendTestWa(e)} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[var(--color-ink-soft)] font-semibold mb-1">
                  Nomor WhatsApp Tujuan (contoh: 08123456789)
                </label>
                <input
                  type="text"
                  placeholder="081234567890"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] font-mono text-sm"
                  required
                />
              </div>

              {testSuccessMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  {testSuccessMsg}
                </div>
              )}

              {testErrorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  {testErrorMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-line)]">
                <Button variant="secondary" type="button" onClick={() => setShowTestModal(false)}>
                  Tutup
                </Button>
                <Button type="submit" disabled={testing}>
                  {testing ? "Sending..." : "Kirim WA Uji Coba"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
