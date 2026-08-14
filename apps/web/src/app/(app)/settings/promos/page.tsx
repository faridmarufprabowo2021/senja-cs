"use client";

import { motion } from "framer-motion";
import { Plus, Tag, Trash2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { isManager } from "@/lib/roles";

export interface PromoVoucher {
  id: string;
  code: string;
  title: string;
  description: string;
  discountAmount: number;
  discountPercent: number;
  minSpend: number;
  validUntil: string;
  active: boolean;
  createdAt: string;
}

export default function PromoSettingsPage() {
  const manager = isManager();
  const [promos, setPromos] = useState<PromoVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minSpend, setMinSpend] = useState(0);
  const [validUntil, setValidUntil] = useState("Berlaku Setiap Saat");
  const [active, setActive] = useState(true);

  const loadPromos = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api<PromoVoucher[]>("/promos");
      setPromos(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar promo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromos();
  }, [loadPromos]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleCreatePromo(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !title.trim() || busy) return;
    setBusy(true);
    setError("");

    try {
      await api<PromoVoucher>("/promos", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim(),
          title: title.trim(),
          description: description.trim(),
          minSpend: Number(minSpend) || 0,
          validUntil: validUntil.trim() || "Berlaku Setiap Saat",
          active,
        }),
      });

      setShowModal(false);
      resetForm();
      await loadPromos();
      flash("Voucher promo berhasil ditambahkan!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah promo");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(promo: PromoVoucher) {
    try {
      const updated = await api<PromoVoucher>(`/promos/${promo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !promo.active }),
      });
      setPromos((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, active: updated.active } : p)),
      );
      flash(updated.active ? "Voucher diaktifkan!" : "Voucher dinonaktifkan!");
    } catch {
      setError("Gagal mengubah status promo");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus kode voucher promo ini?")) return;
    try {
      await api(`/promos/${id}`, { method: "DELETE" });
      setPromos((prev) => prev.filter((p) => p.id !== id));
      flash("Voucher promo berhasil dihapus.");
    } catch {
      setError("Gagal menghapus promo");
    }
  }

  function resetForm() {
    setCode("");
    setTitle("");
    setDescription("");
    setMinSpend(0);
    setValidUntil("Berlaku Setiap Saat");
    setActive(true);
  }

  if (loading) {
    return <div className="p-8 text-xs text-slate-500 font-medium">Memuat daftar promo...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Pengaturan Voucher & Promo Diskon AI"
        description="Kelola voucher diskon toko Anda. Bot AI hanya akan memberikan voucher yang diaktifkan oleh pemilik bisnis di halaman ini."
        action={
          manager ? (
            <Button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <Plus className="h-4 w-4 mr-1" />
              + Tambah Voucher Baru
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

      {promos.length === 0 ? (
        <Card className="p-8 text-center space-y-3 border-dashed border-slate-300">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 grid place-items-center text-slate-400">
            <Tag className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-sm text-slate-800">Belum Ada Voucher Promo Aktif</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Jika pelanggan bertanya tentang promo di WhatsApp, AI Agent akan menyampaikan bahwa saat ini belum ada promo aktif. Klik tombol di atas untuk menambah voucher pertama Anda!
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {promos.map((p) => (
            <Card
              key={p.id}
              className={`p-5 space-y-3 border transition-all ${
                p.active
                  ? "border-emerald-200 bg-white shadow-xs"
                  : "border-slate-200 bg-slate-50/70 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
                      🎟️ {p.code}
                    </span>
                    <Badge tone={p.active ? "success" : "default"}>
                      {p.active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 pt-1">{p.title}</h4>
                </div>

                {manager ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(p)}
                      className={`relative h-5 w-9 rounded-full transition ${
                        p.active ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                      title={p.active ? "Nonaktifkan" : "Aktifkan"}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition ${
                          p.active ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => void handleDelete(p.id)}
                      className="text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50"
                      title="Hapus Voucher"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              {p.description ? (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {p.description}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100">
                <span>
                  {p.minSpend > 0
                    ? `Min. Belanja: Rp ${p.minSpend.toLocaleString("id-ID")}`
                    : "Tanpa min. belanja"}
                </span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  📅 {p.validUntil}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Add Promo Voucher */}
      {showModal ? (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center font-bold">
                  <Tag className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Tambah Voucher Promo Baru</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Kode Voucher *</label>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Misal: SENJAHEBAT10, PROMO2026..."
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Judul Promo *</label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Misal: Diskon 10% Semua Produk, Gratis Ongkir Rp 20rb..."
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Deskripsi Syarat & Ketentuan</label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Penjelasan singkat untuk disampaikan ke pelanggan di WA..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Minimal Belanja (Rp)</label>
                  <Input
                    type="number"
                    value={minSpend}
                    onChange={(e) => setMinSpend(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Masa Berlaku</label>
                  <Input
                    type="text"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    placeholder="Misal: 31 Des 2026"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-bold text-slate-700">Status Aktifkan Langsung</span>
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    active ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      active ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={!code.trim() || !title.trim() || busy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {busy ? "Menyimpan..." : "Simpan Voucher"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
