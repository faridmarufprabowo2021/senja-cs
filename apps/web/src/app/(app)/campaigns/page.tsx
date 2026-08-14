"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  Megaphone,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  StopCircle,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { BroadcastTemplate, Campaign, CampaignRecipient } from "@cs/shared";
import { CAMPAIGN_STATUS_LABEL } from "@cs/shared";
import { Badge, Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { isManager } from "@/lib/roles";

const AVAILABLE_TAGS = ["semua", "baru", "hot", "order", "followup", "komplain"];

const SPEED_PRESETS = [
  {
    id: "safe",
    title: "🛡️ Aman & Anti-Banned (Direkomendasikan)",
    desc: "Jeda acak 5 - 15 detik/pesan. Mirip pola mengetik manusia.",
    min: "5",
    max: "15",
  },
  {
    id: "fast",
    title: "⚡ Cepat",
    desc: "Jeda 2 - 5 detik/pesan. Untuk pengiriman mendesak jumlah sedikit.",
    min: "2",
    max: "5",
  },
  {
    id: "relaxed",
    title: "🐢 Sangat Santai",
    desc: "Jeda 15 - 30 detik/pesan. Sangat aman untuk kontak baru.",
    min: "15",
    max: "30",
  },
];

function statusTone(s: Campaign["status"]) {
  if (s === "running") return "accent" as const;
  if (s === "completed") return "success" as const;
  if (s === "cancelled") return "warn" as const;
  if (s === "failed") return "danger" as const;
  return "default" as const;
}

export default function CampaignsPage() {
  const manager = isManager();
  const [items, setItems] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [activeDetail, setActiveDetail] = useState<{
    campaign: Campaign;
    recipients: CampaignRecipient[];
  } | null>(null);
  const [recipientFilter, setRecipientFilter] = useState<"all" | "sent" | "failed" | "pending">("all");
  const [recipientSearch, setRecipientSearch] = useState("");

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [message, setMessage] = useState(
    "Halo {{name}}, dapatkan penawaran promo spesial servis elektronik & konsultasi teknis dari kami hari ini!",
  );
  const [imageUrl, setImageUrl] = useState("");
  const [selectedTagMode, setSelectedTagMode] = useState<string>("semua");
  const [speedPreset, setSpeedPreset] = useState("safe");
  const [delayMinSec, setDelayMinSec] = useState("5");
  const [delayMaxSec, setDelayMaxSec] = useState("15");

  // Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplMessage, setTplMessage] = useState("");
  const [tplImageUrl, setTplImageUrl] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [campaignsList, templatesList] = await Promise.all([
        api<Campaign[]>("/campaigns"),
        api<BroadcastTemplate[]>("/campaigns/templates").catch(() => []),
      ]);
      setItems(campaignsList);
      setTemplates(templatesList);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat kampanye");
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => {
      void loadData();
    }, 5000); // Auto refresh progress every 5s
    return () => clearInterval(timer);
  }, [loadData]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const applySpeedPreset = (presetId: string) => {
    setSpeedPreset(presetId);
    const p = SPEED_PRESETS.find((x) => x.id === presetId);
    if (p) {
      setDelayMinSec(p.min);
      setDelayMaxSec(p.max);
    }
  };

  const insertVariable = (varName: string) => {
    setMessage((prev) => `${prev} {{${varName}}}`);
  };

  function selectTemplate(tpl: BroadcastTemplate) {
    setName(`Broadcast: ${tpl.name}`);
    setMessage(tpl.message);
    setImageUrl(tpl.imageUrl || "");
    flash(`Template "${tpl.name}" berhasil diterapkan!`);
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!tplName.trim() || !tplMessage.trim() || busy) return;
    setBusy(true);
    try {
      const created = await api<BroadcastTemplate>("/campaigns/templates", {
        method: "POST",
        body: JSON.stringify({
          name: tplName.trim(),
          message: tplMessage.trim(),
          imageUrl: tplImageUrl.trim() || null,
        }),
      });
      setTemplates((prev) => [created, ...prev]);
      setShowTemplateModal(false);
      setTplName("");
      setTplMessage("");
      setTplImageUrl("");
      flash("Template broadcast berhasil disimpan!");
    } catch (err) {
      setError("Gagal menyimpan template broadcast");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Hapus template broadcast ini?")) return;
    try {
      await api(`/campaigns/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      flash("Template berhasil dihapus.");
    } catch {
      setError("Gagal menghapus template");
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, target: "form" | "template") {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api<{ fileUrl: string }>("/media/upload", {
        method: "POST",
        body: formData,
      });
      if (target === "form") setImageUrl(res.fileUrl);
      else setTplImageUrl(res.fileUrl);
      flash("Gambar brosur berhasil diunggah!");
    } catch {
      setError("Gagal mengunggah gambar. Pastikan format PNG/JPG.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api("/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          message: message.trim(),
          imageUrl: imageUrl.trim() || null,
          targetTag: selectedTagMode === "semua" ? null : selectedTagMode,
          delayMinSec: parseInt(delayMinSec, 10) || 5,
          delayMaxSec: parseInt(delayMaxSec, 10) || 15,
        }),
      });
      setName("");
      await loadData();
      flash("🚀 Kampanye broadcast berhasil dibuat dan sedang dikirim secara otomatis!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kampanye");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(id: string) {
    setBusy(true);
    try {
      await api(`/campaigns/${id}/cancel`, { method: "POST" });
      await loadData();
      flash("Kampanye dibatalkan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan kampanye");
    } finally {
      setBusy(false);
    }
  }

  async function viewDetail(id: string) {
    try {
      const res = await api<{
        campaign: Campaign;
        recipients: CampaignRecipient[];
      }>(`/campaigns/${id}`);
      setActiveDetail(res);
      setRecipientFilter("all");
      setRecipientSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail");
    }
  }

  function exportRecipientReportCSV() {
    if (!activeDetail) return;
    const { campaign, recipients } = activeDetail;

    const headers = ["Nama Kontak", "Nomor WA", "Status Terkirim", "Waktu Terkirim", "Alasan Error"];
    const rows = recipients.map((r) => [
      `"${r.contactName.replace(/"/g, '""')}"`,
      `"${r.contactPhone}"`,
      `"${r.status.toUpperCase()}"`,
      `"${r.sentAt ? new Date(r.sentAt).toLocaleString("id-ID") : "-"}"`,
      `"${(r.error || "-").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Broadcast_${campaign.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Simulated Preview Message
  const simulatedPreview = message.replace(/\{\{name\}\}/g, "Budi Santoso");

  // Filtered Recipients for Report Modal
  const filteredRecipients = activeDetail?.recipients.filter((r) => {
    const matchFilter = recipientFilter === "all" || r.status === recipientFilter;
    const matchSearch =
      r.contactName.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.contactPhone.includes(recipientSearch);
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Broadcast Massal & Template Manager"
        description="Kirim pesan promosi massal dilengkapi gambar brosur, pilihan template, serta laporan status penerimaan terperinci."
        action={
          manager ? (
            <Button
              onClick={() => setShowTemplateModal(true)}
              className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-bold"
            >
              <FileText className="h-4 w-4 mr-1 text-emerald-600" />
              + Buat Template Baru
            </Button>
          ) : null
        }
      />

      {toast ? (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Broadcast Templates Bar */}
      {templates.length > 0 ? (
        <Card className="p-4 space-y-2 border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              📄 Template Broadcast Tersimpan (Klik untuk gunakan):
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {templates.length} Template Siap Pakai
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-1 bg-white border border-emerald-200 rounded-xl px-3 py-1.5 shadow-2xs hover:border-emerald-400 transition"
              >
                <button
                  type="button"
                  onClick={() => selectTemplate(t)}
                  className="text-xs font-bold text-emerald-900 hover:underline flex items-center gap-1.5"
                >
                  {t.imageUrl ? "🖼️" : "📝"} {t.name}
                </button>
                {manager ? (
                  <button
                    onClick={() => void handleDeleteTemplate(t.id)}
                    className="text-slate-400 hover:text-rose-600 p-0.5 ml-1 rounded"
                    title="Hapus Template"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Buat Broadcast */}
        <Card className="p-6 lg:col-span-7 space-y-5 border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-md">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-base text-slate-900">Buat Kampanye Broadcast Baru</h2>
              <p className="text-xs text-slate-500">Kirim pesan massal beserta media gambar brosur ke pelanggan</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-5">
            {/* 1. Nama Kampanye */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-800">
                1. Nama Kampanye Broadcast *
              </label>
              <Input
                type="text"
                placeholder="Contoh: Promo Servis AC Agustus / Diskon Spesial Pelanggan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* 2. Target Label Contact */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-800">
                <span>2. Target Segmentasi Kontak *</span>
                <span className="text-[11px] font-medium text-slate-500">Pilih segmen penerima</span>
              </label>

              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTagMode(t)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition ${
                      selectedTagMode === t
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-2xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    {t === "semua" ? "🌐 Semua Kontak WA" : `Tag: ${t}`}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Upload Gambar Brosur (Opsional) */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
                3. Gambar Brosur / Banner Broadcast (Opsional)
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="URL Gambar (misal: https://example.com/banner.png)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1"
                />
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
                  <UploadCloud className="h-4 w-4 text-slate-500" />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleImageUpload(e, "form")}
                    className="hidden"
                  />
                </label>
              </div>
              {imageUrl ? (
                <div className="mt-2 relative rounded-xl border border-slate-200 overflow-hidden max-h-36 bg-slate-50 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Banner Broadcast" className="h-36 object-contain" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>

            {/* 4. Isi Pesan WA */}
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
                <label className="text-xs font-bold text-slate-800">
                  4. Isi Pesan WhatsApp *
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500">Sisipkan:</span>
                  <button
                    type="button"
                    onClick={() => insertVariable("name")}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    + Nama Kontak {"{{name}}"}
                  </button>
                </div>
              </div>

              <Textarea
                rows={5}
                placeholder="Tulis pesan promosi di sini..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            {/* 5. Safe Delay Speed Presets */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  5. Kecepatan Pengiriman & Anti-Banned
                </div>
                <span className="text-[10px] text-slate-500">Jeda Otomatis Antar Pesan</span>
              </div>

              <div className="space-y-2">
                {SPEED_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applySpeedPreset(p.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      speedPreset === p.id
                        ? "border-emerald-500 bg-white shadow-xs"
                        : "border-slate-200 bg-white/60 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{p.title}</span>
                      {speedPreset === p.id ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={busy} className="w-full py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
              <Play className="h-4 w-4 mr-1" />
              Mulai Kirim Broadcast Sekarang
            </Button>
          </form>
        </Card>

        {/* Live WA Preview & History */}
        <div className="space-y-6 lg:col-span-5">
          {/* Live Preview Box */}
          <Card className="p-5 space-y-3 bg-[#e5ddd5]/30 border-[#c5b8a5]">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <MessageSquare className="h-4 w-4 text-[#075e54]" />
              Simulasi Tampilan Pesan di WA Pelanggan:
            </div>

            {/* WA Chat Bubble Simulation */}
            <div className="rounded-2xl border border-[#d1c7b7] bg-white p-3.5 shadow-xs text-xs leading-relaxed space-y-2">
              {imageUrl ? (
                <div className="rounded-xl overflow-hidden mb-2 max-h-40 bg-slate-100 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Preview Broadcast" className="h-40 object-cover w-full" />
                </div>
              ) : null}
              <div className="whitespace-pre-wrap text-slate-800">{simulatedPreview}</div>
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                <span>10:45</span>
                <Check className="h-3 w-3 text-[#4fc3f7]" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 text-center">
              Variabel <code className="rounded bg-white px-1">{"{{name}}"}</code> akan otomatis berganti dengan nama asli tiap penerima.
            </p>
          </Card>

          {/* Riwayat Broadcast & Progress */}
          <Card className="p-5 space-y-4 border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-bold text-sm text-slate-900">Riwayat & Status Broadcast</h2>
              <Button size="sm" variant="secondary" onClick={() => void loadData()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto">
              {items.map((c) => {
                const pct =
                  c.totalCount > 0
                    ? Math.round(((c.sentCount + c.failedCount) / c.totalCount) * 100)
                    : 100;

                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 p-3.5 space-y-2 bg-slate-50/70 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            {c.imageUrl ? "🖼️ " : ""}{c.name}
                          </span>
                          <Badge tone={statusTone(c.status)}>
                            {CAMPAIGN_STATUS_LABEL[c.status]}
                          </Badge>
                        </div>
                        <span className="mt-0.5 inline-block text-[10px] text-slate-500">
                          Target: {c.targetTag ? `Tag [${c.targetTag}]` : "Semua Kontak"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void viewDetail(c.id)}
                          className="font-bold text-xs bg-emerald-50 text-emerald-800 border-emerald-200"
                        >
                          📊 Laporan
                        </Button>
                        {c.status === "running" ? (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => void handleCancel(c.id)}
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                            Stop
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>
                          Terkirim: <b className="text-emerald-700">{c.sentCount}</b> / {c.totalCount} (Gagal: <b className="text-rose-600">{c.failedCount}</b>)
                        </span>
                        <span className="font-bold text-slate-800">{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-emerald-600 transition-all duration-300"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {!items.length ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Belum ada kampanye broadcast.
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal Detailed Broadcast Recipient Report */}
      {activeDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-6 bg-white shadow-2xl rounded-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  📊 Laporan Pengiriman Broadcast: {activeDetail.campaign.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Rincian daftar penerima, waktu pengiriman, dan status penerimaan pesan.
                </p>
              </div>
              <button
                onClick={() => setActiveDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stat Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold">TOTAL TARGET</div>
                <div className="text-lg font-extrabold text-slate-900">{activeDetail.campaign.totalCount} Kontak</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] text-emerald-700 font-bold">BERHASIL TERKIRIM</div>
                <div className="text-lg font-extrabold text-emerald-800">{activeDetail.campaign.sentCount} Kontak</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <div className="text-[11px] text-rose-700 font-bold">GAGAL TERKIRIM</div>
                <div className="text-lg font-extrabold text-rose-800">{activeDetail.campaign.failedCount} Kontak</div>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                {(["all", "sent", "failed", "pending"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setRecipientFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      recipientFilter === st
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st === "all" ? "Semua" : st === "sent" ? "Terkirim" : st === "failed" ? "Gagal" : "Menunggu"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama / no WA..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="pl-8 pr-3 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={exportRecipientReportCSV}
                  className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-bold text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Recipient Table List */}
            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
              {filteredRecipients?.map((r) => (
                <div
                  key={r.id}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 transition"
                >
                  <div>
                    <div className="font-bold text-slate-900">{r.contactName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{r.contactPhone}</div>
                  </div>

                  <div className="text-right space-y-1">
                    <Badge
                      tone={
                        r.status === "sent"
                          ? "success"
                          : r.status === "failed"
                            ? "danger"
                            : "warn"
                      }
                    >
                      {r.status === "sent" ? "✅ Terkirim" : r.status === "failed" ? "❌ Gagal" : "⏳ Menunggu"}
                    </Badge>
                    {r.sentAt ? (
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(r.sentAt).toLocaleString("id-ID")}
                      </div>
                    ) : null}
                    {r.error ? (
                      <div className="text-[10px] text-rose-600 font-medium max-w-xs truncate" title={r.error}>
                        Error: {r.error}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {!filteredRecipients?.length ? (
                <div className="p-6 text-center text-slate-400">Tidak ada data penerima yang cocok.</div>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* Modal Add Template */}
      {showTemplateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center font-bold">
                  <FileText className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Buat Template Broadcast Baru</h3>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Template *</label>
                <Input
                  type="text"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Misal: Promo Flash Sale Akhir Bulan"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Gambar Brosur (Opsional)</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={tplImageUrl}
                    onChange={(e) => setTplImageUrl(e.target.value)}
                    placeholder="URL Gambar Banner..."
                    className="flex-1"
                  />
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
                    <UploadCloud className="h-4 w-4 text-slate-500" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleImageUpload(e, "template")}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Isi Pesan Broadcast Template *</label>
                <Textarea
                  rows={4}
                  value={tplMessage}
                  onChange={(e) => setTplMessage(e.target.value)}
                  placeholder="Gunakan {{name}} untuk menyapa nama pelanggan..."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowTemplateModal(false)}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={!tplName.trim() || !tplMessage.trim() || busy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {busy ? "Menyimpan..." : "Simpan Template"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
