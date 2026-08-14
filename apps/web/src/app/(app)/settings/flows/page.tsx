"use client";

import { motion } from "framer-motion";
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Edit3,
  Trash2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, PageHeader } from "@/components/ui";

type FlowItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  nodesJson: any[];
  edgesJson: any[];
  updatedAt: string;
};

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  const loadFlows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<{ ok: boolean; data: FlowItem[] }>("/flows");
      if (res.ok) {
        setFlows(res.data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFlows();
  }, [loadFlows]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await api<{ ok: boolean; data: FlowItem }>("/flows", {
        method: "POST",
        body: JSON.stringify({ name, description, isActive: true }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setName("");
        setDescription("");
        void loadFlows();
      }
    } catch {
      /* ignore */
    }
  }

  async function handleGenerateAi(promptText?: string, presetType?: string) {
    const finalPrompt = promptText || aiPrompt;
    if (!finalPrompt.trim() && !presetType) return;

    try {
      setGeneratingAi(true);
      const res = await api<{ ok: boolean; data: FlowItem }>("/flows/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: finalPrompt, presetType }),
      });
      if (res.ok && res.data) {
        setShowAiModal(false);
        setAiPrompt("");
        window.location.href = `/settings/flows/${res.data.id}`;
      }
    } catch {
      /* ignore */
    } finally {
      setGeneratingAi(false);
    }
  }

  async function toggleActive(flow: FlowItem) {
    try {
      await api(`/flows/${flow.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !flow.isActive }),
      });
      void loadFlows();
    } catch {
      /* ignore */
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus alur flow ini?")) return;
    try {
      await api(`/flows/${id}`, { method: "DELETE" });
      void loadFlows();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        description="Rancang alur percakapan visual drag-and-drop, otomatisasi promo, pengiriman foto/katalog, dan handover agen."
        title="Visual Drag-and-Drop Flow Builder"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowAiModal(true)}
              className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
            >
              <Sparkles className="mr-2 h-4 w-4 text-emerald-500" /> Buat Alur dengan AI
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" /> Buat Alur Kosong
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="grid h-64 place-items-center">
          <div className="flex flex-col items-center gap-3 text-[var(--color-muted)]">
            <Sparkles className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
            <p className="text-sm font-medium">Memuat alur flow otomatisasi...</p>
          </div>
        </div>
      ) : flows.length === 0 ? (
        <Card className="grid h-64 place-items-center text-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <GitBranch className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">Belum Ada Alur Visual</h3>
            <p className="text-sm text-[var(--color-muted)] max-w-md">
              Buat alur percakapan visual pertama Anda untuk mengatur automasi promo, pengiriman foto produk, dan QRIS secara otomatis!
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" /> Buat Alur Pertama
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <motion.div key={flow.id} layout>
              <Card className="flex flex-col justify-between p-5 space-y-4 hover:border-primary/50 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        flow.isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-500/10 text-slate-500"
                      }`}
                    >
                      {flow.isActive ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aktif ⚡
                        </>
                      ) : (
                        <>
                          <Pause className="h-3 w-3" /> Nonaktif
                        </>
                      )}
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {flow.nodesJson?.length || 0} Nodes
                    </span>
                  </div>

                  <h4 className="text-base font-bold">{flow.name}</h4>
                  {flow.description && (
                    <p className="text-xs text-[var(--color-muted)] line-clamp-2">
                      {flow.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                  <button
                    onClick={() => void toggleActive(flow)}
                    className="text-xs font-medium flex items-center gap-1 text-[var(--color-muted)] hover:text-foreground"
                  >
                    {flow.isActive ? (
                      <>
                        <Pause className="h-3.5 w-3.5" /> Matikan
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Aktifkan
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleDelete(flow.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <Link href={`/settings/flows/${flow.id}`}>
                      <Button size="sm" variant="secondary">
                        <Edit3 className="mr-1 h-3.5 w-3.5" /> Edit Flow <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Buat Alur Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[var(--color-line)] space-y-4 text-[var(--color-ink)]">
            <h3 className="text-lg font-bold">Buat Alur Automation Flow Baru</h3>

            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--color-ink-soft)]">
                  Nama Alur Flow
                </label>
                <input
                  type="text"
                  required
                  placeholder="misal: Alur Promo Es Teh & QRIS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--color-ink-soft)]">
                  Keterangan / Deskripsi
                </label>
                <textarea
                  rows={3}
                  placeholder="Keterangan alur otomatisasi promo atau booking..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Batal
                </Button>
                <Button type="submit">Buat & Buka Kanvas Editor</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal AI Flow Generator */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[var(--color-line)] space-y-5 text-[var(--color-ink)] my-8">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-500" /> AI Auto-Flow Generator
                </h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Ketik instruksi bahasa sehari-hari atau pilih template preset UMKM.
                </p>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-xs text-[var(--color-muted)] hover:text-black"
              >
                Tutup
              </button>
            </div>

            {/* Template Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-ink-soft)] uppercase tracking-wider">
                ⚡ Template Preset Instan UMKM
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => void handleGenerateAi("", "toko_qris")}
                  disabled={generatingAi}
                  className="flex flex-col text-left p-3 rounded-xl border border-emerald-500/30 bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors"
                >
                  <span className="font-bold text-emerald-700">🛍️ Toko Online & QRIS</span>
                  <span className="text-[10px] text-[var(--color-muted)] mt-0.5">Pesan ➔ Foto Menu ➔ QRIS B2</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateAi("", "booking_klinik")}
                  disabled={generatingAi}
                  className="flex flex-col text-left p-3 rounded-xl border border-purple-500/30 bg-purple-50/50 hover:bg-purple-100/50 transition-colors"
                >
                  <span className="font-bold text-purple-700">📅 Booking Klinik/Salon</span>
                  <span className="text-[10px] text-[var(--color-muted)] mt-0.5">Info ➔ Tanggal ➔ Alih CS</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateAi("", "filter_faq")}
                  disabled={generatingAi}
                  className="flex flex-col text-left p-3 rounded-xl border border-blue-500/30 bg-blue-50/50 hover:bg-blue-100/50 transition-colors"
                >
                  <span className="font-bold text-blue-700">❓ Filter FAQ & CS</span>
                  <span className="text-[10px] text-[var(--color-muted)] mt-0.5">AI RAG ➔ Filter Komplain</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateAi("", "kuesioner")}
                  disabled={generatingAi}
                  className="flex flex-col text-left p-3 rounded-xl border border-amber-500/30 bg-amber-50/50 hover:bg-amber-100/50 transition-colors"
                >
                  <span className="font-bold text-amber-700">📋 Kuesioner & Webhook</span>
                  <span className="text-[10px] text-[var(--color-muted)] mt-0.5">Survei ➔ Google Sheets</span>
                </button>
              </div>
            </div>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[var(--color-line)]"></div>
              <span className="flex-shrink mx-3 text-xs text-[var(--color-muted)]">atau ketik instruksi bebas</span>
              <div className="flex-grow border-t border-[var(--color-line)]"></div>
            </div>

            {/* Custom Prompt Textarea */}
            <form onSubmit={(e) => { e.preventDefault(); void handleGenerateAi(); }} className="space-y-3">
              <div>
                <textarea
                  rows={3}
                  required
                  placeholder="misal: Buatkan alur jualan nasi goreng: tanya porsi besar/kecil, kirim foto menu, buatkan invoice jika setuju..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAiModal(false)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={generatingAi}>
                  {generatingAi ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-spin" /> Menyusun Alur AI...
                    </>
                  ) : (
                    "Generasi Alur Sekarang"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
