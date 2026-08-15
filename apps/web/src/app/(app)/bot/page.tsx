"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Plus,
  Sparkles,
  BookOpen,
  Layers,
  Clock,
  Send,
  Check,
  Trash2,
  Image as ImageIcon,
  MessageSquare,
  Zap,
  ShieldAlert,
  Smartphone,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import type { AiAgent, BotSettings, KnowledgeDocument, WaSession } from "@cs/shared";
import { Badge, Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { isManager } from "@/lib/roles";

type TabType = "general" | "knowledge" | "integrations" | "channels" | "followups" | "hours";

type SimulatorMsg = {
  id: string;
  sender: "user" | "bot";
  text: string;
  tool?: string;
};

export default function BotPage() {
  const manager = isManager();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string>("");
  const [allDocs, setAllDocs] = useState<KnowledgeDocument[]>([]);
  const [waSessions, setWaSessions] = useState<WaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("general");

  // Create New Agent Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDesc, setNewAgentDesc] = useState("");

  // Global Bot Settings State
  const [botSettings, setBotSettings] = useState<BotSettings | null>(null);

  // Edit Active Agent State
  const [editForm, setEditForm] = useState<Partial<AiAgent>>({});
  const [kwInput, setKwInput] = useState("");

  // Live Simulator Chat State
  const [simMessage, setSimMessage] = useState("");
  const [simSending, setSimSending] = useState(false);
  const [simChat, setSimChat] = useState<SimulatorMsg[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [agentsList, docsList, sessionsList, settingsData] = await Promise.all([
        api<AiAgent[]>("/ai-agents"),
        api<KnowledgeDocument[]>("/knowledge").catch(() => []),
        api<WaSession[]>("/wa/sessions").catch(() => []),
        api<BotSettings>("/bot/settings").catch(() => null),
      ]);
      setAgents(agentsList);
      setAllDocs(docsList);
      setWaSessions(sessionsList);
      if (settingsData) setBotSettings(settingsData);

      if (agentsList.length > 0) {
        const target = activeAgentId
          ? agentsList.find((a) => a.id === activeAgentId) || agentsList[0]
          : agentsList[0];
        setActiveAgentId(target.id);
        setEditForm(target);
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data AI Agent");
    } finally {
      setLoading(false);
    }
  }, [activeAgentId]);

  useEffect(() => {
    if (!manager) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [manager, loadData]);

  const selectAgent = (agent: AiAgent) => {
    setActiveAgentId(agent.id);
    setEditForm(agent);
    setSimChat([
      {
        id: "welcome",
        sender: "bot",
        text: agent.welcomeMessage || "Halo! Selamat datang. Ada yang bisa saya bantu?",
      },
    ]);
  };

  async function handleCreateAgent() {
    if (!newAgentName.trim()) {
      setError("Nama AI Agent wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await api<AiAgent>("/ai-agents", {
        method: "POST",
        body: JSON.stringify({
          name: newAgentName.trim(),
          description: newAgentDesc.trim(),
        }),
      });
      setShowCreateModal(false);
      setNewAgentName("");
      setNewAgentDesc("");
      await loadData();
      selectAgent(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat AI Agent baru");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAgent() {
    if (!activeAgentId) return;
    setSaving(true);
    setError("");
    try {
      if (botSettings) {
        await api("/bot/settings", {
          method: "PATCH",
          body: JSON.stringify({
            businessHoursEnabled: botSettings.businessHoursEnabled,
            businessHoursStart: botSettings.businessHoursStart,
            businessHoursEnd: botSettings.businessHoursEnd,
            businessHoursTz: botSettings.businessHoursTz,
            awayMessage: botSettings.awayMessage,
          }),
        }).catch(() => {});
      }

      const updated = await api<AiAgent>(`/ai-agents/${activeAgentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          avatarUrl: editForm.avatarUrl || null,
          enabled: editForm.enabled,
          systemPrompt: editForm.systemPrompt,
          welcomeMessage: editForm.welcomeMessage,
          welcomeImageUrl: editForm.welcomeImageUrl || null,
          model: editForm.model,
          confidenceThreshold: editForm.confidenceThreshold,
          handoverKeywords: editForm.handoverKeywords,
          cancelDeadlineHours: editForm.cancelDeadlineHours,
          transferConditions: editForm.transferConditions || null,
          followupEnabled: editForm.followupEnabled,
          followupAiDynamic: editForm.followupAiDynamic,
          followupDelayMinutes: editForm.followupDelayMinutes,
          followupMessage: editForm.followupMessage,
          followupStage2Enabled: editForm.followupStage2Enabled,
          followupStage2DelayMinutes: editForm.followupStage2DelayMinutes,
          followupStage2Message: editForm.followupStage2Message,
          quietHoursEnabled: editForm.quietHoursEnabled,
          quietHoursStart: editForm.quietHoursStart,
          quietHoursEnd: editForm.quietHoursEnd,
          quietHoursTz: editForm.quietHoursTz,
          waSessionId: editForm.waSessionId || null,
          channel: editForm.channel || "all",
          knowledgeDocIds: editForm.knowledgeDocIds || [],
        }),
      });
      setEditForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan Agent");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgent(id: string) {
    const target = agents.find((a) => a.id === id);
    if (target?.isDefault) {
      alert("AI Agent Default tidak dapat dihapus.");
      return;
    }
    if (!confirm(`Hapus AI Agent "${target?.name}"?`)) return;
    try {
      await api(`/ai-agents/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus Agent");
    }
  }

  async function handleSendSimulatorMessage() {
    if (!simMessage.trim() || !activeAgentId || simSending) return;
    const userText = simMessage.trim();
    setSimMessage("");

    const newMsg: SimulatorMsg = {
      id: String(Date.now()),
      sender: "user",
      text: userText,
    };
    const updatedHistory = [...simChat, newMsg];
    setSimChat(updatedHistory);
    setSimSending(true);

    try {
      const res = await api<{ reply: string; toolCalls?: any[] }>(
        `/ai-agents/${activeAgentId}/simulator`,
        {
          method: "POST",
          body: JSON.stringify({
            message: userText,
            history: updatedHistory.slice(-6).map((m) => ({
              sender: m.sender,
              text: m.text,
            })),
          }),
        },
      );

      setSimChat((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "bot",
          text: res.reply,
          tool: res.toolCalls?.[0]?.function?.name,
        },
      ]);
    } catch {
      setSimChat((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "bot",
          text: "Maaf, terjadi kesalahan koneksi saat menguji balasan AI.",
        },
      ]);
    } finally {
      setSimSending(false);
    }
  }

  function toggleDocBinding(docId: string) {
    const current = editForm.knowledgeDocIds || [];
    const next = current.includes(docId)
      ? current.filter((id) => id !== docId)
      : [...current, docId];
    setEditForm((prev) => ({ ...prev, knowledgeDocIds: next }));
  }

  function addKeyword() {
    const k = kwInput.trim().toLowerCase();
    if (!k) return;
    const current = editForm.handoverKeywords || [];
    if (!current.includes(k)) {
      setEditForm((prev) => ({
        ...prev,
        handoverKeywords: [...current, k],
      }));
    }
    setKwInput("");
  }

  function removeKeyword(k: string) {
    const current = editForm.handoverKeywords || [];
    setEditForm((prev) => ({
      ...prev,
      handoverKeywords: current.filter((item) => item !== k),
    }));
  }

  if (!manager) {
    return (
      <div className="p-8">
        <PageHeader
          title="Pengaturan AI Agent"
          description="Hanya owner/admin yang mengelola AI Agent."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--color-muted)]">
        Memuat konfigurasi Multi-AI Agent…
      </div>
    );
  }

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="AI Agent Management"
        description="Kelola banyak AI Agent, instruksi gaya bahasa, Knowledge Source, & integrasi otomatisasi."
        action={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Buat AI Agent Baru
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-500 font-medium">
          {error}
        </div>
      ) : null}

      {/* Top Multi-Agent Selector Bar */}
      <div className="mb-6 flex overflow-x-auto gap-3 pb-2 scrollbar-none">
        {agents.map((agent) => {
          const isSelected = agent.id === activeAgentId;
          return (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent)}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all min-w-[220px] ${
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]/20 shadow-md ring-1 ring-[var(--color-accent)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-faint)]"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 text-white font-bold">
                {agent.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate text-[var(--color-ink)]">
                    {agent.name}
                  </span>
                  {agent.isDefault ? (
                    <Badge tone="accent">Default</Badge>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">
                  {agent.channel === "all"
                    ? "Semua Channel"
                    : agent.channel === "whatsapp"
                      ? "WhatsApp"
                      : "Instagram"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Settings & Live Simulator */}
      {activeAgent ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: 5 Modular Tabs Settings */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-5">
              {/* Modular Tab Navigation */}
              <div className="flex border-b border-[var(--color-line)] mb-5 overflow-x-auto gap-1">
                <button
                  onClick={() => setActiveTab("general")}
                  className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "general"
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Bot className="h-4 w-4" />
                  General & Persona
                </button>

                <button
                  onClick={() => setActiveTab("knowledge")}
                  className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "knowledge"
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  Knowledge Sources ({editForm.knowledgeDocIds?.length || 0})
                </button>

                <button
                  onClick={() => setActiveTab("integrations")}
                  className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "integrations"
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  Integrations
                </button>

                <button
                  onClick={() => setActiveTab("channels")}
                  className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "channels"
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  Channels
                </button>

                <button
                  onClick={() => setActiveTab("followups")}
                  className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "followups"
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  Followups
                </button>

                <button
                  onClick={() => setActiveTab("hours")}
                  className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "hours"
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Clock className="h-4 w-4 text-purple-600" />
                  ⏰ Jam Kerja & Away Message
                </button>
              </div>

              {/* Tab 1: General & Persona */}
              {activeTab === "general" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                        Nama AI Agent
                      </label>
                      <Input
                        value={editForm.name || ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                        Model LLM
                      </label>
                      <select
                        value={editForm.model || "claude-sonnet-4.5"}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, model: e.target.value }))
                        }
                        className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs"
                      >
                        <option value="claude-sonnet-4.5">Claude Sonnet 4.5 (Rekomendasi Cerdas)</option>
                        <option value="gpt-4o">GPT-4o Multimodal Vision</option>
                        <option value="gpt-4o-mini">GPT-4o-Mini (Hemat Biaya)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                      AI Agent Behavior (Instruksi Gaya Bahasa & Identitas)
                    </label>
                    <Textarea
                      rows={5}
                      value={editForm.systemPrompt || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          systemPrompt: e.target.value,
                        }))
                      }
                      placeholder="Atur instruksi persona AI..."
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                      Welcome Message (Pesan Pertama Otomatis)
                    </label>
                    <Textarea
                      rows={2}
                      value={editForm.welcomeMessage || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          welcomeMessage: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                        URL Banner Foto Welcome (Opsional)
                      </label>
                      <Input
                        value={editForm.welcomeImageUrl || ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            welcomeImageUrl: e.target.value,
                          }))
                        }
                        placeholder="https://.../banner-welcome.jpg"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                        Batas Batal Mandiri (Jam)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={editForm.cancelDeadlineHours ?? 2}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            cancelDeadlineHours: Number(e.target.value) || 2,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-muted)] flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      Agent Transfer Conditions (Kondisi Pengalihan ke CS Manusia)
                    </label>
                    <Textarea
                      rows={2}
                      value={editForm.transferConditions || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          transferConditions: e.target.value,
                        }))
                      }
                      placeholder="Tentukan kapan AI harus menyerahkan obrolan ke tim CS manusia..."
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                      Keyword Handover (Pengalihan Manual)
                    </label>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {(editForm.handoverKeywords || []).map((k) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs text-[var(--color-accent)]"
                        >
                          {k}
                          <button
                            type="button"
                            onClick={() => removeKeyword(k)}
                            className="hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={kwInput}
                        onChange={(e) => setKwInput(e.target.value)}
                        placeholder="Tambah kata kunci misal: cs, admin"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                      />
                      <Button variant="secondary" onClick={addKeyword}>
                        Tambah
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Tab 2: Knowledge Sources */}
              {activeTab === "knowledge" ? (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--color-muted)]">
                    Pilih dokumen Knowledge Base yang boleh diakses oleh AI Agent <strong>{editForm.name}</strong>:
                  </p>
                  <div className="divide-y divide-[var(--color-line)] border rounded-xl border-[var(--color-line)] p-2 max-h-72 overflow-y-auto">
                    {allDocs.map((doc) => {
                      const isBound = (editForm.knowledgeDocIds || []).includes(doc.id);
                      return (
                        <label
                          key={doc.id}
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--color-accent-soft)]/10 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isBound}
                              onChange={() => toggleDocBinding(doc.id)}
                              className="h-4 w-4 rounded text-[var(--color-accent)]"
                            />
                            <div>
                              <div className="font-medium text-xs text-[var(--color-ink)]">
                                {doc.title}
                              </div>
                              <div className="text-[11px] text-[var(--color-muted)]">
                                Format: {doc.sourceType.toUpperCase()} • Chunk: {doc.chunkCount || 0}
                              </div>
                            </div>
                          </div>
                          <Badge tone={isBound ? "success" : "default"}>
                            {isBound ? "Terhubung" : "Tidak Terhubung"}
                          </Badge>
                        </label>
                      );
                    })}
                    {!allDocs.length ? (
                      <div className="p-6 text-center text-xs text-[var(--color-muted)]">
                        Belum ada dokumen Knowledge. Silakan unggah dokumen di menu <strong>Knowledge</strong>.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Tab 3: Integrations */}
              {activeTab === "integrations" ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2">
                    <label className="font-bold text-xs text-slate-800 block flex items-center gap-1.5">
                      🚚 Kota / Lokasi Asal Pengiriman Toko (Shipping Origin) *
                    </label>
                    <p className="text-[11px] text-slate-600">
                      Tentukan nama kota/kecamatan asal pengiriman barang toko Anda untuk menghitung tarif ongkir akurat ke alamat pelanggan.
                    </p>
                    <Input
                      type="text"
                      value={botSettings?.shippingOrigin || "Surakarta"}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBotSettings((prev) => (prev ? { ...prev, shippingOrigin: val } : null));
                        api("/bot/settings", {
                          method: "PATCH",
                          body: JSON.stringify({ shippingOrigin: val }),
                        }).catch(() => {});
                      }}
                      placeholder="Contoh: Jakarta Selatan, Surabaya, Bandung, Surakarta..."
                      className="bg-white border-emerald-300 font-semibold text-slate-800"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--color-line)] p-3.5 bg-emerald-500/5 flex items-start gap-3">
                      <Zap className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-[var(--color-ink)]">Cek Ongkir (RajaOngkir & Live Courier)</div>
                        <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Mengecek tarif ongkir JNE, J&T, SiCepat, Paxel secara otomatis dari chat pelanggan.</div>
                        <Badge tone="success" className="mt-2">Aktif</Badge>
                      </div>
                    </div>

                  <div className="rounded-xl border border-[var(--color-line)] p-3.5 bg-blue-500/5 flex items-start gap-3">
                    <Zap className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-xs text-[var(--color-ink)]">Lacak Resi Ekspedisi</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Melacak nomor resi dan posisi paket pengiriman pelanggan secara *realtime*.</div>
                      <Badge tone="success" className="mt-2">Aktif</Badge>
                    </div>
                  </div>

                   <div className="rounded-xl border border-[var(--color-line)] p-3.5 bg-rose-500/5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs text-[var(--color-ink)]">🎟️ Cek Voucher & Kode Promo (Diskon)</div>
                        <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Mengecek & memberikan kode voucher diskon / promo aktif ke pelanggan.</div>
                        <Badge tone="success" className="mt-2">Dinamis (Owner Managed)</Badge>
                      </div>
                    </div>
                    <Link
                      href="/settings/promos"
                      className="text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-white border border-rose-200 px-2.5 py-1 rounded-lg shrink-0 hover:bg-rose-50"
                    >
                      ⚙️ Atur Promo
                    </Link>
                  </div>

                  <div className="rounded-xl border border-[var(--color-line)] p-3.5 bg-teal-500/5 flex items-start gap-3">
                    <Zap className="h-5 w-5 text-teal-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-xs text-[var(--color-ink)]">🧾 Cek Invoice Tagihan & Link Bayar</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Memberikan status nota rincian tagihan & link bayar transaksi pelanggan.</div>
                      <Badge tone="success" className="mt-2">Aktif</Badge>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-line)] p-3.5 bg-amber-500/5 flex items-start gap-3">
                    <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-xs text-[var(--color-ink)]">⭐ Survei Ulasan & Rating Pelanggan</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Mencatat ulasan dan rating kepuasan (1-5 bintang) dari chat pelanggan.</div>
                      <Badge tone="success" className="mt-2">Aktif</Badge>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-line)] p-3.5 bg-amber-500/5 flex items-start gap-3">
                    <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-xs text-[var(--color-ink)]">Auto H-1 Booking Reminder</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">Mengirimkan pengingat jadwal reservasi otomatis 24 jam sebelum tindakan.</div>
                      <Badge tone="success" className="mt-2">Aktif</Badge>
                    </div>
                  </div>
                </div>
              </div>
              ) : null}

              {/* Tab 4: Channels */}
              {activeTab === "channels" ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                      Kanal Komunikasi yang Dilayani
                    </label>
                    <select
                      value={editForm.channel || "all"}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, channel: e.target.value }))
                      }
                      className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs"
                    >
                      <option value="all">Semua Kanal (WhatsApp & Instagram)</option>
                      <option value="whatsapp">Khusus WhatsApp</option>
                      <option value="instagram">Khusus Instagram DM</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                      Target WhatsApp Session (Jika Memiliki Banyak Nomor WA)
                    </label>
                    <select
                      value={editForm.waSessionId || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          waSessionId: e.target.value || null,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs"
                    >
                      <option value="">Semua Sesi WhatsApp (Default)</option>
                      {waSessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({s.phone || "No HP tidak terdeteksi"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {/* Tab 5: Followups */}
              {activeTab === "followups" ? (
                <div className="space-y-4">
                  {/* Master Toggle Stage 1 */}
                  <div className="flex items-center justify-between p-3.5 border rounded-xl border-indigo-200 bg-indigo-50/20">
                    <div>
                      <div className="font-semibold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-indigo-600" />
                        Aktifkan Auto Follow-Up AI (Tahap 1)
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        AI otomatis mengontak pelanggan jika berhenti membalas chat setelah waktu menganggur tertentu.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!editForm.followupEnabled}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          followupEnabled: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded text-[var(--color-accent)] cursor-pointer"
                    />
                  </div>

                  {/* AI Dynamic Contextual Generator Toggle */}
                  <div className="flex items-center justify-between p-3.5 border rounded-xl border-purple-200 bg-purple-50/20">
                    <div>
                      <div className="font-semibold text-xs text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        🧠 Generasi Pesan Personal AI (Kontekstual Chat)
                      </div>
                      <div className="text-[11px] text-purple-700/80 mt-0.5">
                        AI membaca riwayat chat pelanggan dan membuat pesan sapaan yang mengacu khusus pada produk/layanan yang tadi mereka tanyakan!
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editForm.followupAiDynamic ?? true}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          followupAiDynamic: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 rounded text-purple-600 cursor-pointer"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">
                        ⏱️ Jeda Menganggur Tahap 1 (Menit)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={10080}
                        value={editForm.followupDelayMinutes ?? 15}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            followupDelayMinutes: Number(e.target.value) || 15,
                          }))
                        }
                        placeholder="15"
                      />
                      <span className="text-[10px] text-[var(--color-muted)] mt-0.5 block">Contoh: 15 (15 menit), 60 (1 jam), 180 (3 jam).</span>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">
                        💬 Template Pesan Sapaan Tahap 1 (Fallback)
                      </label>
                      <Textarea
                        rows={2}
                        value={editForm.followupMessage || ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            followupMessage: e.target.value,
                          }))
                        }
                        placeholder="Template sapaan follow-up tahap 1..."
                      />
                    </div>
                  </div>

                  {/* Stage 2 Urgency & Special Promo Offer Toggle */}
                  <div className="pt-3 border-t border-[var(--color-line)] space-y-3">
                    <div className="flex items-center justify-between p-3.5 border rounded-xl border-amber-200 bg-amber-50/30">
                      <div>
                        <div className="font-semibold text-xs text-amber-900 flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-amber-600" />
                          🔥 Aktifkan Follow-Up Tahap 2 (Promo & Urgency Special Offer)
                        </div>
                        <div className="text-[11px] text-amber-700/90 mt-0.5">
                          Jika pelanggan masih menganggur setelah Tahap 1, AI akan mengirimkan penawaran voucher/diskon khusus terbatas untuk dorong penjualan!
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!editForm.followupStage2Enabled}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            followupStage2Enabled: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 rounded text-amber-600 cursor-pointer"
                      />
                    </div>

                    {editForm.followupStage2Enabled ? (
                      <div className="grid gap-3 sm:grid-cols-2 bg-amber-50/10 p-3 rounded-xl border border-amber-100">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">
                            ⏱️ Jeda Menganggur Tahap 2 (Menit)
                          </label>
                          <Input
                            type="number"
                            min={1}
                            max={10080}
                            value={editForm.followupStage2DelayMinutes ?? 1440}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                followupStage2DelayMinutes: Number(e.target.value) || 1440,
                              }))
                            }
                            placeholder="1440"
                          />
                          <span className="text-[10px] text-[var(--color-muted)] mt-0.5 block">Contoh: 1440 = 24 jam setelah chat pertama.</span>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">
                            🎁 Template Pesan Promo/Urgency Tahap 2
                          </label>
                          <Textarea
                            rows={3}
                            value={editForm.followupStage2Message || ""}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                followupStage2Message: e.target.value,
                              }))
                            }
                            placeholder="Halo Kak, khusus hari ini kami ada penawaran voucher promo..."
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Quiet Hours DND Guard Settings */}
                  <div className="pt-3 border-t border-[var(--color-line)] space-y-3">
                    <div className="flex items-center justify-between p-3.5 border rounded-xl border-purple-200 bg-purple-50/20">
                      <div>
                        <div className="font-semibold text-xs text-purple-950 flex items-center gap-1.5">
                          🌙 Proteksi Jam Istirahat (Quiet Hours & DND Guard)
                        </div>
                        <div className="text-[11px] text-purple-700/80 mt-0.5">
                          Mencegah AI mengirim pesan follow-up di malam hari agar nomor WA tidak di-report spam/banned oleh pelanggan!
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={editForm.quietHoursEnabled ?? true}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            quietHoursEnabled: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 rounded text-purple-600 cursor-pointer"
                      />
                    </div>

                    {editForm.quietHoursEnabled ?? true ? (
                      <div className="grid gap-3 sm:grid-cols-3 bg-purple-50/10 p-3 rounded-xl border border-purple-100">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">
                            🌙 Jam Mulai (DND)
                          </label>
                          <Input
                            type="text"
                            value={editForm.quietHoursStart || "22:00"}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                quietHoursStart: e.target.value,
                              }))
                            }
                            placeholder="22:00"
                          />
                          <span className="text-[10px] text-[var(--color-muted)] mt-0.5 block">Format 24-jam (misal 22:00)</span>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">
                            ☀️ Jam Selesai (DND)
                          </label>
                          <Input
                            type="text"
                            value={editForm.quietHoursEnd || "08:00"}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                quietHoursEnd: e.target.value,
                              }))
                            }
                            placeholder="08:00"
                          />
                          <span className="text-[10px] text-[var(--color-muted)] mt-0.5 block">Format 24-jam (misal 08:00)</span>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[var(--color-ink)]">
                            🌍 Zona Waktu (Timezone)
                          </label>
                          <select
                            value={editForm.quietHoursTz || "Asia/Jakarta"}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                quietHoursTz: e.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium"
                          >
                            <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                            <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                            <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Tab 6: Jam Kerja AI & Away Message */}
              {activeTab === "hours" ? (
                <div className="space-y-4">
                  {/* Master Toggle Jam Kerja */}
                  <div className="flex items-center justify-between p-4 border rounded-2xl border-purple-200 bg-purple-50/40">
                    <div>
                      <div className="font-bold text-sm text-purple-950 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-purple-600" />
                        Aktifkan Pembatasan Jam Kerja Operasional AI
                      </div>
                      <div className="text-xs text-purple-800/80 mt-0.5">
                        Jika diaktifkan, di luar jam kerja operasional AI Bot secara otomatis membalas dengan pesan khusus ("Away Message") dan menunda balasan otomatis biasa.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!botSettings?.businessHoursEnabled}
                      onChange={(e) =>
                        setBotSettings((prev) =>
                          prev ? { ...prev, businessHoursEnabled: e.target.checked } : null,
                        )
                      }
                      className="h-5 w-5 rounded text-purple-600 cursor-pointer"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700">
                        🌅 Jam Mulai Operasional (Buka)
                      </label>
                      <Input
                        type="text"
                        value={botSettings?.businessHoursStart || "08:00"}
                        onChange={(e) =>
                          setBotSettings((prev) =>
                            prev ? { ...prev, businessHoursStart: e.target.value } : null,
                          )
                        }
                        placeholder="08:00"
                        className="font-mono text-center font-bold text-slate-800"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Format 24 Jam (hh:mm)</span>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700">
                        🌙 Jam Selesai Operasional (Tutup)
                      </label>
                      <Input
                        type="text"
                        value={botSettings?.businessHoursEnd || "22:00"}
                        onChange={(e) =>
                          setBotSettings((prev) =>
                            prev ? { ...prev, businessHoursEnd: e.target.value } : null,
                          )
                        }
                        placeholder="22:00"
                        className="font-mono text-center font-bold text-slate-800"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Format 24 Jam (hh:mm)</span>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700">
                        🌏 Zona Waktu (Timezone)
                      </label>
                      <select
                        value={botSettings?.businessHoursTz || "Asia/Jakarta"}
                        onChange={(e) =>
                          setBotSettings((prev) =>
                            prev ? { ...prev, businessHoursTz: e.target.value } : null,
                          )
                        }
                        className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-slate-800"
                      >
                        <option value="Asia/Jakarta">WIB - Asia/Jakarta (UTC+7)</option>
                        <option value="Asia/Makassar">WITA - Asia/Makassar (UTC+8)</option>
                        <option value="Asia/Jayapura">WIT - Asia/Jayapura (UTC+9)</option>
                      </select>
                      <span className="text-[10px] text-slate-400 mt-1 block">Zona waktu toko</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      💬 Pesan Otomatis Luar Jam Kerja (Away Message)
                    </label>
                    <Textarea
                      rows={3}
                      value={
                        botSettings?.awayMessage ||
                        "Halo Kak, terima kasih telah menghubungi kami! Jam operasional layanan kami adalah pukul 08:00 - 22:00 WIB. Pesan Kakak telah kami terima dan akan dibalas saat jam kerja kembali aktif. Terima kasih! 🙏"
                      }
                      onChange={(e) =>
                        setBotSettings((prev) =>
                          prev ? { ...prev, awayMessage: e.target.value } : null,
                        )
                      }
                      placeholder="Pesan otomatis saat pelanggan chat di luar jam kerja..."
                      className="font-medium text-xs leading-relaxed"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Pesan ini akan otomatis dikirimkan ke WhatsApp pelanggan yang mengirim pesan di luar jam operasional.
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Bottom Action Bar */}
              <div className="mt-6 flex items-center justify-between border-t border-[var(--color-line)] pt-4">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={saving || editForm.isDefault}
                  onClick={() => handleDeleteAgent(activeAgent.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Hapus Agent
                </Button>
                <div className="flex items-center gap-2">
                  {saved ? (
                    <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                      <Check className="h-4 w-4" /> Tersimpan!
                    </span>
                  ) : null}
                  <Button disabled={saving} onClick={() => void handleSaveAgent()}>
                    {saving ? "Menyimpan…" : "Simpan Perubahan Agent"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Live Test Chat Simulator */}
          <div className="lg:col-span-5">
            <Card className="p-5 flex flex-col h-[640px]">
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white font-bold text-xs">
                    {activeAgent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                      Live Simulator Chat
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h3>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      Menguji persona AI {activeAgent.name}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setSimChat([
                      {
                        id: "welcome",
                        sender: "bot",
                        text: editForm.welcomeMessage || "Halo! Ada yang bisa dibantu?",
                      },
                    ])
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>

              {/* Chat Bubble List */}
              <div className="flex-1 overflow-y-auto space-y-3 p-2 border rounded-xl border-[var(--color-line)] bg-slate-950/20">
                {simChat.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        m.sender === "user"
                          ? "bg-[var(--color-accent)] text-white rounded-br-none"
                          : "bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line)] rounded-bl-none shadow-xs"
                      }`}
                    >
                      {m.tool ? (
                        <div className="mb-1 inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400 font-medium">
                          🛠️ Tool Call: {m.tool}
                        </div>
                      ) : null}
                      <div>{m.text}</div>
                    </div>
                  </div>
                ))}
                {simSending ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] p-3 text-xs text-[var(--color-muted)] animate-pulse">
                      AI sedang berpikir…
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Chat Input Bar */}
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  placeholder={`Ketik pesan ke ${activeAgent.name}…`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSendSimulatorMessage();
                    }
                  }}
                />
                <Button
                  disabled={simSending || !simMessage.trim()}
                  onClick={() => void handleSendSimulatorMessage()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Modal Create Agent */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-display text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--color-accent)]" />
              Buat AI Agent Baru
            </h3>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                Nama AI Agent
              </label>
              <Input
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="Cth: Dr. Maya Assistant / Agent Sales IG"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                Deskripsi
              </label>
              <Input
                value={newAgentDesc}
                onChange={(e) => setNewAgentDesc(e.target.value)}
                placeholder="Cth: Khusus menangani reservasi & konsultasi"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                Batal
              </Button>
              <Button disabled={saving} onClick={() => void handleCreateAgent()}>
                {saving ? "Membuat…" : "Buat Agent"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
