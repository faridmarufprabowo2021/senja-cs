"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Tag, UserCheck, Wallet } from "lucide-react";
import type { ContactDetail, ContactSummary } from "@cs/shared";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

function formatRp(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export default function ContactsPage() {
  const [items, setItems] = useState<ContactSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  // Modals
  const [editingContact, setEditingContact] = useState<ContactSummary | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [activeDetail, setActiveDetail] = useState<ContactDetail | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedTag) params.set("tag", selectedTag);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const list = await api<ContactSummary[]>(`/contacts${qs}`);
      setItems(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat kontak");
    }
  }, [search, selectedTag]);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Collect all unique tags in current items for filter pills
  const allTags = Array.from(new Set(items.flatMap((c) => c.tags)));

  async function handleAddTag(contact: ContactSummary, tagToAdd: string) {
    const clean = tagToAdd.trim().toLowerCase();
    if (!clean || contact.tags.includes(clean)) return;

    const newTags = [...contact.tags, clean];
    setBusy(true);
    try {
      await api(`/contacts/${contact.id}/tags`, {
        method: "PATCH",
        body: JSON.stringify({ tags: newTags }),
      });
      setTagInput("");
      setEditingContact((prev) => (prev ? { ...prev, tags: newTags } : null));
      await load();
      flash(`Tag "${clean}" berhasil ditambahkan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui tag");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveTag(contact: ContactSummary, tagToRemove: string) {
    const newTags = contact.tags.filter((t) => t !== tagToRemove);
    setBusy(true);
    try {
      await api(`/contacts/${contact.id}/tags`, {
        method: "PATCH",
        body: JSON.stringify({ tags: newTags }),
      });
      setEditingContact((prev) => (prev ? { ...prev, tags: newTags } : null));
      await load();
      flash(`Tag "${tagToRemove}" dihapus.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus tag");
    } finally {
      setBusy(false);
    }
  }

  async function viewDetail(id: string) {
    try {
      const res = await api<ContactDetail>(`/contacts/${id}`);
      setActiveDetail(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail kontak");
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Kontak & CRM Lite"
        description="Kelola data pelanggan, statistik LTV (Total Belanja), dan Tag Kontak untuk target Broadcast."
      />

      {toast ? (
        <p className="mb-4 rounded-xl bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent)]">
          {toast}
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-sm text-[var(--color-sunset)]">
          {error}
        </p>
      ) : null}

      {/* Filter & Search Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Cari nama atau nomor WA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-line)] bg-white pl-9 pr-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedTag("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              !selectedTag
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-paper-2)] text-[var(--color-muted)]"
            }`}
          >
            Semua Tag
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedTag === tag
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-paper-2)] text-[var(--color-muted)]"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List Table */}
      <Card className="overflow-x-auto p-4">
        <table className="w-full text-left text-sm border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-muted)]">
              <th className="pb-3 font-semibold">Pelanggan</th>
              <th className="pb-3 font-semibold">Nomor WA</th>
              <th className="pb-3 font-semibold">Tag Kontak</th>
              <th className="pb-3 font-semibold">Total Omzet (LTV)</th>
              <th className="pb-3 font-semibold">Order / Booking</th>
              <th className="pb-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--color-paper-2)] transition">
                <td className="py-3 font-medium flex items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white shrink-0"
                    style={{
                      backgroundColor: `hsl(${c.avatarHue}, 65%, 45%)`,
                    }}
                  >
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>{c.name}</span>
                </td>
                <td className="py-3 text-xs text-[var(--color-muted)]">{c.phone}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]"
                      >
                        #{t}
                      </span>
                    ))}
                    {!c.tags.length ? (
                      <span className="text-[10px] text-[var(--color-faint)]">
                        — (Tanpa tag)
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="py-3 font-semibold text-[var(--color-accent)]">
                  {formatRp(c.totalSpent)}
                </td>
                <td className="py-3 text-xs">
                  {c.orderCount} Order · {c.bookingCount} Booking
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingContact(c)}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      Edit Tag
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void viewDetail(c.id)}
                    >
                      Riwayat
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-[var(--color-muted)]">
                  Belum ada data kontak pelanggan. Kontak akan otomatis tercatat dari percakapan WA.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {/* Modal Tag Editor */}
      {editingContact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-5 bg-white shadow-xl space-y-4">
            <h3 className="font-bold text-base">
              Kelola Tag Kontak: {editingContact.name}
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-muted)]">
                Tag Kontak Saat Ini:
              </label>
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 border rounded-xl">
                {editingContact.tags.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 rounded bg-[var(--color-accent-soft)] px-2 py-1 text-xs font-medium text-[var(--color-accent)]"
                  >
                    #{t}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRemoveTag(editingContact, t)}
                      className="ml-1 text-red-500 hover:text-red-700 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {!editingContact.tags.length ? (
                  <span className="text-xs text-[var(--color-faint)]">
                    Belum ada tag ditambahkan.
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="cth: vip, pasien, promo"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              />
              <Button
                size="sm"
                disabled={busy || !tagInput.trim()}
                onClick={() => void handleAddTag(editingContact, tagInput)}
              >
                <Plus className="h-4 w-4" />
                Tambah Tag
              </Button>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingContact(null)}
              >
                Selesai
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Modal Detail & History */}
      {activeDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-5 bg-white shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-bold text-base">{activeDetail.name}</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  {activeDetail.phone} · Total Belanja: {formatRp(activeDetail.totalSpent)}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setActiveDetail(null)}>
                Tutup
              </Button>
            </div>

            <div className="overflow-y-auto flex-1 py-4 space-y-4">
              <div>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[var(--color-faint)] mb-2">
                  Riwayat Pesanan ({activeDetail.orders.length})
                </h4>
                <div className="space-y-2">
                  {activeDetail.orders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border text-xs bg-[var(--color-paper-2)]"
                    >
                      <div>
                        <div className="font-semibold">Order #{o.id.slice(-6).toUpperCase()}</div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          {new Date(o.createdAt).toLocaleString("id-ID")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[var(--color-accent)]">
                          {formatRp(o.total)}
                        </div>
                        <Badge tone={o.status === "paid" ? "success" : "default"}>
                          {o.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {!activeDetail.orders.length ? (
                    <p className="text-xs text-[var(--color-muted)]">Belum ada pesanan.</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[var(--color-faint)] mb-2">
                  Riwayat Booking ({activeDetail.bookings.length})
                </h4>
                <div className="space-y-2">
                  {activeDetail.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border text-xs bg-[var(--color-paper-2)]"
                    >
                      <div>
                        <div className="font-semibold">{b.serviceName}</div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          Jadwal: {new Date(b.bookingDate).toLocaleString("id-ID")}
                        </div>
                      </div>
                      <Badge tone={b.status === "completed" ? "success" : "warn"}>
                        {b.status}
                      </Badge>
                    </div>
                  ))}
                  {!activeDetail.bookings.length ? (
                    <p className="text-xs text-[var(--color-muted)]">Belum ada booking.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
