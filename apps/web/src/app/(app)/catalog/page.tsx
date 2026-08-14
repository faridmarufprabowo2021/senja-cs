"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Trash2, Check, RefreshCw } from "lucide-react";
import type { Product } from "@cs/shared";
import { Badge, Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { isManager } from "@/lib/roles";

function formatRp(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

type ExtractedProductDraft = {
  name: string;
  price: number;
  stock: number | null;
  unit: string;
  description: string;
};

export default function CatalogPage() {
  const manager = isManager();
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // AI Extraction State
  const [showAiModal, setShowAiModal] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [draftProducts, setDraftProducts] = useState<ExtractedProductDraft[]>([]);
  const [aiSuccessMsg, setAiSuccessMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await api<Product[]>("/products?all=1");
      setItems(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat katalog");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addProduct() {
    if (!name.trim() || !price) {
      setError("Nama dan harga wajib");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          price: Math.max(0, Math.floor(Number(price) || 0)),
          stock: stock === "" ? null : Math.max(0, Math.floor(Number(stock) || 0)),
          unit: unit.trim() || "pcs",
          description: description.trim(),
          imageUrl: imageUrl.trim() || null,
        }),
      });
      setName("");
      setPrice("");
      setStock("");
      setDescription("");
      setImageUrl("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal tambah produk");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Product) {
    setBusy(true);
    try {
      await api(`/products/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !p.active }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update");
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(id: string) {
    if (!confirm("Nonaktifkan produk ini?")) return;
    setBusy(true);
    try {
      await api(`/products/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal hapus");
    } finally {
      setBusy(false);
    }
  }

  async function handleExtractAi() {
    setExtracting(true);
    setError("");
    setAiSuccessMsg("");
    try {
      const res = await api<{
        ok: boolean;
        count: number;
        products: ExtractedProductDraft[];
      }>("/products/extract-from-knowledge", {
        method: "POST",
      });
      setDraftProducts(res.products);
      if (!res.products.length) {
        setError("AI tidak menemukan daftar produk/harga yang jelas dalam dokumen Knowledge.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengekstrak dari Knowledge");
    } finally {
      setExtracting(false);
    }
  }

  function handleUpdateDraft(index: number, field: keyof ExtractedProductDraft, value: any) {
    setDraftProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleRemoveDraft(index: number) {
    setDraftProducts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleBatchSaveDrafts() {
    if (!draftProducts.length) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ ok: boolean; count: number }>("/products/batch-import", {
        method: "POST",
        body: JSON.stringify({
          products: draftProducts,
        }),
      });
      setAiSuccessMsg(`Sukses menambahkan ${res.count} produk ke katalog toko!`);
      setTimeout(() => {
        setShowAiModal(false);
        setDraftProducts([]);
        setAiSuccessMsg("");
      }, 1500);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan produk batch");
    } finally {
      setBusy(false);
    }
  }

  if (!manager) {
    return (
      <div className="p-8">
        <PageHeader
          title="Katalog"
          description="Hanya owner/admin yang mengelola produk."
        />
        <p className="text-sm text-[var(--color-muted)]">
          Agent bisa lihat pesanan di menu Pesanan.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Katalog"
        description="Produk untuk bot commerce (harga, stok, order draft)."
        action={
          <Button
            onClick={() => {
              setShowAiModal(true);
              if (!draftProducts.length) void handleExtractAi();
            }}
          >
            <Sparkles className="h-4 w-4" />
            Ekstrak Katalog AI (Knowledge)
          </Button>
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-sm text-[var(--color-sunset)]">
          {error}
        </p>
      ) : null}

      <Card className="mb-6 space-y-3 p-5">
        <h2 className="text-sm font-medium">Tambah produk manual</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              Nama
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kopi Susu / Service TV"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              Harga (Rp)
            </label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="18000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              Stok (kosong = unlimited)
            </label>
            <Input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              Unit
            </label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="pcs"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              Deskripsi
            </label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi produk opsional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              URL Foto / Gambar Produk
            </label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... /foto-roti.jpg"
            />
          </div>
        </div>
        <Button onClick={() => void addProduct()} disabled={busy}>
          {busy ? "Menyimpan…" : "Tambah Manual"}
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Card key={p.id} className={`p-4 ${!p.active ? "opacity-60" : ""}`}>
            {p.imageUrl ? (
              <div className="mb-3 h-36 w-full overflow-hidden rounded-xl bg-slate-100">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-[var(--color-accent)]">
                  {formatRp(p.price)}
                  <span className="text-xs text-[var(--color-muted)]">
                    /{p.unit}
                  </span>
                </div>
              </div>
              <Badge tone={p.active ? "success" : "default"}>
                {p.active ? "aktif" : "nonaktif"}
              </Badge>
            </div>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Stok: {p.stock == null ? "—" : p.stock}
            </p>
            {p.description ? (
              <p className="mb-3 line-clamp-2 text-xs text-[var(--color-faint)]">
                {p.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void toggleActive(p)}
              >
                {p.active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => void removeProduct(p.id)}
              >
                Hapus
              </Button>
            </div>
          </Card>
        ))}
        {!items.length ? (
          <p className="text-sm text-[var(--color-muted)]">
            Belum ada produk. Tambah di form atas atau gunakan fitur **Ekstrak Katalog AI**.
          </p>
        ) : null}
      </div>

      {/* AI Extraction Modal */}
      {showAiModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-3xl p-6 shadow-2xl max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
                  Ekstraksi AI Katalog dari Knowledge Base
                </h3>
                <p className="text-xs text-[var(--color-muted)]">
                  AI membaca dokumen FAQ/Pricelist di Knowledge Base & mengurai item harga menjadi katalog.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={extracting}
                onClick={() => void handleExtractAi()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${extracting ? "animate-spin" : ""}`} />
                Pindai Ulang
              </Button>
            </div>

            {aiSuccessMsg ? (
              <div className="mt-4 rounded-xl bg-[var(--color-accent-soft)] p-3 text-xs text-[var(--color-accent)] font-semibold">
                {aiSuccessMsg}
              </div>
            ) : null}

            {/* Editable Table */}
            <div className="my-4 flex-1 overflow-y-auto border rounded-xl border-[var(--color-line)] p-2">
              {extracting ? (
                <div className="p-8 text-center text-xs text-[var(--color-muted)]">
                  Memindai dokumen Knowledge Base & mengekstrak produk dengan AI…
                </div>
              ) : draftProducts.length ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                      <th className="p-2">Nama Produk / Layanan</th>
                      <th className="p-2 w-28">Harga (Rp)</th>
                      <th className="p-2 w-20">Stok</th>
                      <th className="p-2 w-20">Unit</th>
                      <th className="p-2">Deskripsi</th>
                      <th className="p-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {draftProducts.map((p, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <Input
                            value={p.name}
                            onChange={(e) => handleUpdateDraft(idx, "name", e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={p.price}
                            onChange={(e) => handleUpdateDraft(idx, "price", Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            placeholder="∞"
                            value={p.stock == null ? "" : p.stock}
                            onChange={(e) =>
                              handleUpdateDraft(
                                idx,
                                "stock",
                                e.target.value === "" ? null : Number(e.target.value),
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={p.unit}
                            onChange={(e) => handleUpdateDraft(idx, "unit", e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={p.description}
                            onChange={(e) => handleUpdateDraft(idx, "description", e.target.value)}
                          />
                        </td>
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveDraft(idx)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-xs text-[var(--color-muted)]">
                  Belum ada produk yang diekstrak. Pastikan dokumen di menu **Knowledge** sudah berisi info harga/tarif.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-4">
              <span className="text-xs text-[var(--color-muted)]">
                Terdeteksi: <strong className="text-[var(--color-ink)]">{draftProducts.length} produk/layanan</strong> (Bisa di-edit manual)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setShowAiModal(false)}>
                  Batal
                </Button>
                <Button
                  disabled={busy || !draftProducts.length}
                  onClick={() => void handleBatchSaveDrafts()}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Simpan {draftProducts.length} Produk ke Katalog
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
