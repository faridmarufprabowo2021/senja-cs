"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Filter,
  GitBranch,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import type { ContactSummary, Pipeline, PipelineDeal, PipelineStage } from "@cs/shared";

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "won" | "lost">("open");

  // Modal State Add Deal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [dealTitle, setDealTitle] = useState("");
  const [dealAmount, setDealAmount] = useState(0);
  const [targetStageId, setTargetStageId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadPipelines() {
    setLoading(true);
    api<Pipeline[]>("/pipelines")
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setPipelines(res);
          setActivePipeline(res[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadContacts() {
    api<{ contacts: ContactSummary[] }>("/contacts?limit=50")
      .then((res) => {
        if (res.contacts) setContacts(res.contacts);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadPipelines();
    loadContacts();
  }, []);

  async function handleMoveStage(dealId: string, newStageId: string, newStatus?: "open" | "won" | "lost") {
    try {
      await api(`/pipelines/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({
          stageId: newStageId,
          ...(newStatus ? { status: newStatus } : {}),
        }),
      });
      loadPipelines();
    } catch (err) {
      alert("Gagal memindahkan stage prospek");
    }
  }

  // Modal State Edit Amount
  const [isEditAmountModalOpen, setIsEditAmountModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState("");
  const [editingAmount, setEditingAmount] = useState(0);

  function openEditAmount(dealId: string, currentAmount: number) {
    setEditingDealId(dealId);
    setEditingAmount(currentAmount);
    setIsEditAmountModalOpen(true);
  }

  async function handleSaveAmount(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDealId) return;

    try {
      await api(`/pipelines/deals/${editingDealId}`, {
        method: "PATCH",
        body: JSON.stringify({ amount: Number(editingAmount) || 0 }),
      });
      setIsEditAmountModalOpen(false);
      loadPipelines();
    } catch (err) {
      alert("Gagal memperbarui nominal");
    }
  }

  async function handleDeleteDeal(dealId: string) {
    if (!confirm("Hapus kartu prospek ini dari pipeline?")) return;
    try {
      await api(`/pipelines/deals/${dealId}`, { method: "DELETE" });
      loadPipelines();
    } catch (err) {
      alert("Gagal menghapus deal");
    }
  }

  async function handleCreateDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!activePipeline || !selectedContactId || !targetStageId || submitting) return;
    setSubmitting(true);

    try {
      const selectedContact = contacts.find((c) => c.id === selectedContactId);
      const title = dealTitle.trim() || `Deal - ${selectedContact?.name || "Pelanggan"}`;

      await api("/pipelines/deals", {
        method: "POST",
        body: JSON.stringify({
          pipelineId: activePipeline.id,
          stageId: targetStageId,
          contactId: selectedContactId,
          title,
          amount: Number(dealAmount) || 0,
        }),
      });

      setIsAddOpen(false);
      setDealTitle("");
      setDealAmount(0);
      loadPipelines();
    } catch (err) {
      alert("Gagal menambah deal baru");
    } finally {
      setSubmitting(false);
    }
  }

  // Calculate totals
  const allDeals = (activePipeline?.stages || []).flatMap((s) => s.deals || []);
  const totalOpenRevenue = allDeals
    .filter((d) => statusFilter === "all" || d.status === statusFilter)
    .reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="AI Auto Pipeline CRM"
        description="Visualisasi prospek penjualan (Kanban Board) dengan klasifikasi stage otomatis oleh AI Agent."
      />

      {/* Top Metric Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-white border-blue-200/80 shadow-2xs">
          <div className="text-xs text-blue-700 font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-blue-600" /> Total Omzet Pipeline
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1.5 font-mono">
            Rp {totalOpenRevenue.toLocaleString("id-ID")}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Potensi transaksi berjalan</div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-white border-purple-200/80 shadow-2xs">
          <div className="text-xs text-purple-700 font-semibold flex items-center gap-1.5">
            <GitBranch className="h-4 w-4 text-purple-600" /> Total Prospek Aktif
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1.5">
            {allDeals.length} Deal
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dalam {activePipeline?.stages.length || 0} Tahap</div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border-emerald-200/80 shadow-2xs">
          <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-600" /> Auto-Shifted AI
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1.5">
            100% Otomatis
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">AI menggeser stage dari chat WA</div>
        </Card>

        <Card className="p-4 bg-slate-50/80 border-slate-200 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Aksi Cepat:</span>
            <Button variant="ghost" size="sm" onClick={loadPipelines} className="h-7 text-xs">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Segarkan
            </Button>
          </div>
          <Button
            onClick={() => {
              if (activePipeline?.stages[0]) setTargetStageId(activePipeline.stages[0].id);
              setIsAddOpen(true);
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1" /> + Tambah Deal Prospek
          </Button>
        </Card>
      </div>

      {/* Filter & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / nomor HP..."
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-500 w-56 font-medium"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setStatusFilter("open")}
              className={`px-3 py-1 rounded-lg transition-all ${
                statusFilter === "open" ? "bg-white text-blue-700 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Aktif (Open)
            </button>
            <button
              onClick={() => setStatusFilter("won")}
              className={`px-3 py-1 rounded-lg transition-all ${
                statusFilter === "won" ? "bg-white text-emerald-700 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Closing Lunas (Won)
            </button>
            <button
              onClick={() => setStatusFilter("lost")}
              className={`px-3 py-1 rounded-lg transition-all ${
                statusFilter === "lost" ? "bg-white text-rose-700 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Batal (Lost)
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg transition-all ${
                statusFilter === "all" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Layers className="h-4 w-4 text-slate-400" /> Pipeline:
          <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg font-bold">
            {activePipeline?.name || "Default Sales Pipeline"}
          </span>
        </div>
      </div>

      {/* Spacious Horizontal Kanban Board Container */}
      {!loading && activePipeline ? (
        <div className="flex gap-4 items-start overflow-x-auto pb-6 pt-1 scrollbar-thin">
          {activePipeline.stages.map((stage) => {
            const filteredDeals = (stage.deals || []).filter((d) => {
              const matchStatus = statusFilter === "all" || d.status === statusFilter;
              const q = searchQuery.toLowerCase().trim();
              const matchSearch =
                !q ||
                d.title.toLowerCase().includes(q) ||
                (d.contact?.name && d.contact.name.toLowerCase().includes(q)) ||
                (d.contact?.phone && d.contact.phone.includes(q));
              return matchStatus && matchSearch;
            });

            const stageTotal = filteredDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

            return (
              <div
                key={stage.id}
                className="w-[300px] shrink-0 bg-slate-100/80 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 shadow-2xs"
              >
                {/* Stage Header */}
                <div className="border-b border-slate-200/80 pb-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: stage.color }}
                      />
                      <h3 className="font-bold text-xs text-slate-900 truncate max-w-[180px]">
                        {stage.name}
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                      {filteredDeals.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Potensi Omzet:</span>
                    <span className="font-mono text-slate-900 font-bold">
                      Rp {stageTotal.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="space-y-2.5 min-h-[420px] max-h-[640px] overflow-y-auto pr-0.5">
                  {filteredDeals.map((deal) => {
                    const avatarHue = deal.contact?.avatarHue || 200;
                    return (
                      <motion.div
                        layout
                        key={deal.id}
                        className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-3 space-y-2.5 shadow-2xs hover:shadow-xs transition-all group relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="h-7 w-7 rounded-full text-white font-bold text-[11px] grid place-items-center shrink-0 shadow-xs"
                              style={{ backgroundColor: `hsl(${avatarHue}, 65%, 45%)` }}
                            >
                              {(deal.contact?.name || "P")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-slate-900 truncate">
                                {deal.contact?.name || deal.title}
                              </h4>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {deal.contact?.phone || "WA Kontak"}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteDeal(deal.id)}
                            className="text-slate-300 hover:text-rose-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Hapus Deal"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Nominal Transaksi & Link Chat */}
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <button
                            onClick={() => openEditAmount(deal.id, deal.amount)}
                            className="font-mono font-bold text-xs text-emerald-700 hover:underline flex items-center gap-1"
                            title="Klik untuk ubah nominal"
                          >
                            <span>Rp {deal.amount.toLocaleString("id-ID")}</span>
                            <span className="text-[10px] text-slate-400">✏️</span>
                          </button>

                          <Link
                            href={`/inbox`}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100"
                          >
                            <MessageSquare className="h-3 w-3" /> Chat
                          </Link>
                        </div>

                        {/* AI Reason Badge */}
                        {deal.lastAiReason ? (
                          <div className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-100 flex items-start gap-1.5">
                            <Sparkles className="h-3 w-3 text-purple-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-tight">{deal.lastAiReason}</span>
                          </div>
                        ) : null}

                        {/* Stage Dropdown Selector */}
                        <div className="pt-0.5">
                          <select
                            value={deal.stageId}
                            onChange={(e) => handleMoveStage(deal.id, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-white transition-colors"
                          >
                            {activePipeline.stages.map((st) => (
                              <option key={st.id} value={st.id}>
                                👉 Pindah: {st.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </motion.div>
                    );
                  })}

                  {!filteredDeals.length ? (
                    <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/50">
                      Belum ada prospek
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Modal Add Deal */}
      {isAddOpen ? (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-md w-full space-y-4 bg-white shadow-xl border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" />
                Tambah Kartu Prospek Baru
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Pilih Kontak Pelanggan *
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 outline-none font-medium"
                  required
                >
                  <option value="">-- Pilih Kontak --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Pilih Tahap (Stage) *
                </label>
                <select
                  value={targetStageId}
                  onChange={(e) => setTargetStageId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 outline-none font-medium"
                  required
                >
                  {(activePipeline?.stages || []).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Estimasi Nilai Transaksi (Rp)
                </label>
                <Input
                  type="number"
                  value={dealAmount}
                  onChange={(e) => setDealAmount(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {submitting ? "Menyimpan..." : "Simpan Prospek"}
              </Button>
            </form>
          </Card>
        </div>
      ) : null}

      {/* Modal Edit Amount Custom */}
      {isEditAmountModalOpen ? (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-sm w-full space-y-4 bg-white shadow-xl border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                ✏️ Edit Nominal Transaksi (Rp)
              </h3>
              <button
                onClick={() => setIsEditAmountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAmount} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nominal Transaksi Baru (Rp)
                </label>
                <Input
                  type="number"
                  value={editingAmount}
                  onChange={(e) => setEditingAmount(Number(e.target.value) || 0)}
                  placeholder="0"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditAmountModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Simpan Nominal
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
