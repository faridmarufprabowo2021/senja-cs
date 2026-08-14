"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { Order, OrderStatus } from "@cs/shared";
import { ORDER_STATUS_LABEL } from "@cs/shared";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api, getSession } from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";
import { formatRelative } from "@/lib/utils";

function formatRp(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

const FILTERS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "draft", label: "Draft" },
  { id: "confirmed", label: "Dikonfirmasi" },
  { id: "paid", label: "Dibayar" },
  { id: "done", label: "Selesai" },
  { id: "cancelled", label: "Batal" },
];

function statusTone(s: OrderStatus) {
  if (s === "draft") return "warn" as const;
  if (s === "confirmed") return "human" as const;
  if (s === "paid" || s === "done") return "success" as const;
  if (s === "cancelled") return "danger" as const;
  return "default" as const;
}

const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["done"],
  done: [],
  cancelled: [],
};

export default function OrdersPage() {
  const [items, setItems] = useState<Order[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const qs =
        filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const list = await api<Order[]>(`/orders${qs}`);
      setItems(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pesanan");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime(
    useCallback(
      (ev) => {
        if (ev === "order.updated" || ev === "order.created") {
          void load();
        }
      },
      [load],
    ),
  );

  async function handleExportCsv() {
    setBusy(true);
    setError("");
    try {
      // window.open tidak membawa header Authorization → 401.
      const session = getSession();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const res = await fetch(`${apiUrl}/orders/export-csv`, {
        headers: {
          ...(session?.token
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
          ...(session?.tenantId
            ? { "X-Tenant-Id": session.tenantId }
            : {}),
        },
      });
      if (!res.ok) {
        throw new Error(`Gagal export CSV (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "laporan-pesanan.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setToast("CSV berhasil di-export");
      setTimeout(() => setToast(""), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export CSV");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: OrderStatus) {
    setBusy(true);
    setError("");
    setToast("");
    try {
      const res = await api<{
        receipt?: { ok: boolean; error?: string };
      }>(`/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      if (status === "paid") {
        if (res.receipt?.ok) {
          setToast("Lunas + nota otomatis terkirim ke WhatsApp");
        } else if (res.receipt && !res.receipt.ok) {
          setToast(
            `Status lunas tersimpan. Nota gagal: ${res.receipt.error ?? "WA tidak terhubung"}`,
          );
        } else {
          setToast("Status lunas tersimpan");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update status");
    } finally {
      setBusy(false);
    }
  }

  // Create Manual Order Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("50000");
  const [newNote, setNewNote] = useState("");

  async function handleManualCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!newContactName || !newContactPhone || !newItemName || !newPrice) return;
    setBusy(true);
    setError("");
    try {
      await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          contactName: newContactName,
          contactPhone: newContactPhone,
          note: newNote,
          status: "confirmed",
          items: [
            {
              name: newItemName,
              qty: parseInt(newQty, 10) || 1,
              price: parseFloat(newPrice) || 0,
            },
          ],
        }),
      });
      await load();
      setShowCreateModal(false);
      setNewContactName("");
      setNewContactPhone("");
      setNewItemName("");
      setNewQty("1");
      setNewPrice("50000");
      setNewNote("");
      setToast("✅ Pesanan manual berhasil dibuat!");
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat pesanan");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendInvoiceWa(orderId: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/orders/${orderId}/invoice`, { method: "POST" });
      setToast("📲 Invoice & QRIS berhasil dikirim ke WhatsApp!");
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim invoice");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Pesanan"
        description="Kelola pesanan dari bot WA atau buat pesanan manual CS — draf, konfirmasi, lunas, atau selesai."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-white font-bold"
              onClick={() => setShowCreateModal(true)}
            >
              + Buat Pesanan Manual
            </Button>
            <Button variant="secondary" onClick={handleExportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      {toast && (
        <p className="mb-4 rounded-xl bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent)]">
          {toast}
        </p>
      )}

      {error && (
        <pre className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-xs text-[var(--color-sunset)]">
          {error}
        </pre>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.id
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-paper-2)] text-[var(--color-muted)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Belum ada pesanan. Pelanggan bisa ketik di WA: &quot;pesan 2 kopi susu&quot;.
        </p>
      ) : (
        <Card className="space-y-3">
          {items.map((o) => (
            <div key={o.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    #{o.id.slice(-6).toUpperCase()} • {formatRp(o.total)}
                  </span>
                  <Badge tone={statusTone(o.status)}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {o.contactName} · {o.contactPhone}
                </p>
                {o.note && (
                  <p className="mt-1 text-xs text-[var(--color-faint)]">
                    Catatan: {o.note}
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Dibuat {formatRelative(o.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleSendInvoiceWa(o.id)}
                  title="Kirim ulang Invoice & QRIS ke WhatsApp pelanggan"
                >
                  📲 Kirim Invoice WA
                </Button>
                {(NEXT[o.status] ?? []).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "cancelled" ? "danger" : "secondary"}
                    disabled={busy}
                    onClick={() => void setStatus(o.id, s)}
                  >
                    → {ORDER_STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Modal Input Pesanan Manual */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-6 bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-[var(--color-ink)]">
                🛒 Buat Pesanan / Order Manual
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nama Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nomor WhatsApp Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 081234567890"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nama Produk / Pesanan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kopi Susu Aren / Paket Servis Kipas"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Jumlah (Qty) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Harga Satuan (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan pesanan, rasa, atau alamat pengiriman..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={busy}
                  className="bg-[var(--color-accent)] text-white font-bold"
                >
                  {busy ? "Menyimpan..." : "Simpan & Buat Pesanan"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

