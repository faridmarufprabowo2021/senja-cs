"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, RefreshCw, Sparkles, FileText, CheckCircle2 } from "lucide-react";
import type { WorkspaceSettings } from "@cs/shared";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { isManager } from "@/lib/roles";

const VARIABLES = [
  { code: "{store_name}", label: "Nama Toko", desc: "Contoh: Warung Senja" },
  { code: "{customer_name}", label: "Nama Pelanggan", desc: "Contoh: Budi Santoso" },
  { code: "{order_ref}", label: "No. Pesanan/Ref", desc: "Contoh: #ORD-A1B2" },
  { code: "{items}", label: "Daftar Barang/Jasa", desc: "Rincian item & harga" },
  { code: "{total}", label: "Total Nominal", desc: "Contoh: Rp150.000" },
  { code: "{status}", label: "Status Pesanan", desc: "Menunggu / Lunas" },
  { code: "{payment_info}", label: "Cara Bayar/Rekening", desc: "Info Bank / QRIS" },
  { code: "{date}", label: "Tanggal & Jam", desc: "Waktu transaksi" },
];

export default function InvoiceFormatSettingsPage() {
  const manager = isManager();
  const [activeTab, setActiveTab] = useState<"invoice" | "receipt">("invoice");

  const [invoiceHeader, setInvoiceHeader] = useState("");
  const [invoiceFooter, setInvoiceFooter] = useState("");
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");

  const [invoiceCustomTemplate, setInvoiceCustomTemplate] = useState("");
  const [receiptCustomTemplate, setReceiptCustomTemplate] = useState("");
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);

  const [previewText, setPreviewText] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<WorkspaceSettings>("/workspace")
      .then((w) => {
        setInvoiceHeader(w.invoiceHeader ?? "");
        setInvoiceFooter(w.invoiceFooter ?? "");
        setReceiptHeader(w.receiptHeader ?? "");
        setReceiptFooter(w.receiptFooter ?? "");
        setInvoiceCustomTemplate(
          w.invoiceCustomTemplate ||
            "🧾 *Invoice {store_name}*\nNo: {order_ref} · {date}\n\nHalo *{customer_name}*,\n\n*Rincian Pesanan*:\n{items}\n\n*Total Tagihan*: *{total}*\nStatus: *{status}*\n\n{payment_info}\n\nTerima kasih 🙏",
        );
        setReceiptCustomTemplate(
          w.receiptCustomTemplate ||
            "✅ *Pembayaran Diterima - Nota Lunas*\n*{store_name}* · No: {order_ref}\n\nHalo *{customer_name}*,\n\nTerima kasih! Pembayaran *{total}* telah kami terima.\n\n*Rincian Pesanan*:\n{items}\n\n*Status*: *{status}*\n\nAda pertanyaan? Balas chat ini saja ya.\nTerima kasih! 🙏",
        );
        setUseCustomTemplate(!!w.useCustomInvoiceTemplate);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Gagal memuat pengaturan"),
      );
  }, []);

  // Fetch live compilation preview from backend
  const updatePreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await api<{ previewText: string }>("/settings/preview-invoice", {
        method: "POST",
        body: JSON.stringify({
          type: activeTab,
          template: activeTab === "invoice" ? invoiceCustomTemplate : receiptCustomTemplate,
          invoiceHeader,
          invoiceFooter,
          receiptHeader,
          receiptFooter,
          useCustomInvoiceTemplate: useCustomTemplate,
        }),
      });
      setPreviewText(res.previewText || "");
    } catch {
      setPreviewText("Gagal memuat pratinjau invoice.");
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void updatePreview();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    activeTab,
    invoiceHeader,
    invoiceFooter,
    receiptHeader,
    receiptFooter,
    invoiceCustomTemplate,
    receiptCustomTemplate,
    useCustomTemplate,
  ]);

  const insertVariable = (code: string) => {
    if (activeTab === "invoice") {
      setInvoiceCustomTemplate((prev) => prev + " " + code);
    } else {
      setReceiptCustomTemplate((prev) => prev + " " + code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handleSave = async () => {
    if (!manager) return;
    setSaving(true);
    setError("");
    try {
      await api("/workspace", {
        method: "PATCH",
        body: JSON.stringify({
          invoiceHeader: invoiceHeader.trim(),
          invoiceFooter: invoiceFooter.trim(),
          receiptHeader: receiptHeader.trim(),
          receiptFooter: receiptFooter.trim(),
          invoiceCustomTemplate: invoiceCustomTemplate.trim(),
          receiptCustomTemplate: receiptCustomTemplate.trim(),
          useCustomInvoiceTemplate: useCustomTemplate,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan format invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Pengaturan Utama
        </Link>
      </div>

      <PageHeader
        title="Format Invoice & Nota Pembayaran"
        description="Sesuaikan tampilan header, footer, dan format teks WhatsApp untuk tagihan (invoice) dan nota pelunasan resmi toko Anda."
        action={
          manager ? (
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Menyimpan..." : saved ? "Tersimpan ✅" : "Simpan Format"}
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-sm text-[var(--color-sunset)]">
          {error}
        </p>
      ) : null}

      {/* Mode Switcher */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Mode Template Nota & Invoice</h2>
            <p className="text-xs text-[var(--color-muted)]">
              Pilih apakah ingin menggunakan format standar dengan kustomisasi Header/Footer, atau menyusun template lengkap sendiri.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUseCustomTemplate(false)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                !useCustomTemplate
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
              }`}
            >
              🏷️ Standar (Header & Footer)
            </button>
            <button
              type="button"
              onClick={() => setUseCustomTemplate(true)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                useCustomTemplate
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
              }`}
            >
              ✨ Custom Template Dinamis
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Form Editor */}
        <div className="space-y-4 lg:col-span-7">
          {/* Tab Selection */}
          <div className="flex border-b border-[var(--color-line)]">
            <button
              type="button"
              onClick={() => setActiveTab("invoice")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === "invoice"
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              <FileText className="h-4 w-4" />
              1. Tagihan Invoice (Belum Lunas)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("receipt")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === "receipt"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              2. Nota Pelunasan (B3 Lunas)
            </button>
          </div>

          {!useCustomTemplate ? (
            /* Mode Standar: Header + Footer Override */
            <Card className="space-y-4 p-5">
              <h3 className="text-sm font-semibold">
                Header & Footer — {activeTab === "invoice" ? "Invoice Tagihan" : "Nota Pelunasan Lunas"}
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Format standar akan menyusun daftar barang, total, dan instruksi bayar secara otomatis. Anda dapat mengubah teks bagian paling atas (Header) dan bagian paling bawah (Footer).
              </p>

              {activeTab === "invoice" ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink)]">
                      Teks Header Invoice (Paling Atas)
                    </label>
                    <Input
                      value={invoiceHeader}
                      onChange={(e) => setInvoiceHeader(e.target.value)}
                      placeholder="Contoh: 🧾 *Invoice Resmi Warung Senja*"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink)]">
                      Teks Footer Invoice (Paling Bawah)
                    </label>
                    <Input
                      value={invoiceFooter}
                      onChange={(e) => setInvoiceFooter(e.target.value)}
                      placeholder="Contoh: Terima kasih sudah berbelanja! 🙏"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink)]">
                      Teks Header Nota Lunas (Paling Atas)
                    </label>
                    <Input
                      value={receiptHeader}
                      onChange={(e) => setReceiptHeader(e.target.value)}
                      placeholder="Contoh: ✅ *Pembayaran Diterima - Nota Lunas*"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink)]">
                      Teks Footer Nota Lunas (Paling Bawah)
                    </label>
                    <Input
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      placeholder="Contoh: Ada pertanyaan? Balas chat ini saja ya. Terima kasih! 🙏"
                    />
                  </div>
                </>
              )}
            </Card>
          ) : (
            /* Mode Custom Template: Textarea + Variable Chips */
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Editor Custom Template — {activeTab === "invoice" ? "Invoice Tagihan" : "Nota Pelunasan Lunas"}
                </h3>
                <Badge tone="accent">Penuh Variabel</Badge>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-[var(--color-ink)]">
                  Klik Variabel untuk Menyisipkan ke Template:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.code}
                      type="button"
                      onClick={() => insertVariable(v.code)}
                      className="group inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition"
                      title={v.desc}
                    >
                      <Sparkles className="h-3 w-3 text-blue-500 group-hover:animate-spin" />
                      {v.code}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--color-ink)]">
                  Template Teks WhatsApp (Dukung Format Bold *teks*, Miring _teks_)
                </label>
                <textarea
                  rows={10}
                  value={activeTab === "invoice" ? invoiceCustomTemplate : receiptCustomTemplate}
                  onChange={(e) => {
                    if (activeTab === "invoice") setInvoiceCustomTemplate(e.target.value);
                    else setReceiptCustomTemplate(e.target.value);
                  }}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white p-3 font-mono text-xs outline-none focus:border-[var(--color-accent)] leading-relaxed"
                />
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: WhatsApp Live Chat Bubble Preview */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5 bg-slate-950 text-slate-100 border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Pratinjau WhatsApp Real-Time
                </h3>
              </div>
              <button
                type="button"
                onClick={() => void updatePreview()}
                className="text-slate-400 hover:text-white transition"
                title="Muat ulang pratinjau"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingPreview ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* WA Chat Wallpaper Container */}
            <div className="rounded-2xl bg-[#0b141a] p-4 border border-slate-800/80 shadow-inner min-h-[320px] flex flex-col justify-end">
              {/* WhatsApp Message Bubble Outgoing */}
              <div className="self-end max-w-[92%] rounded-2xl rounded-tr-none bg-[#005c4b] p-3.5 text-slate-100 shadow-md">
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed font-sans text-slate-100">
                  {previewText}
                </div>
                <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-emerald-200/70">
                  <span>14:30</span>
                  <Check className="h-3 w-3 text-emerald-400" />
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] text-slate-400">
              💬 Ini adalah pratinjau tampilan pesan yang akan diterima oleh pelanggan di aplikasi WhatsApp mereka.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
