"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Zap,
  Image,
  Bot,
  GitBranch,
  CreditCard,
  UserCheck,
  Globe,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  FormInput,
  Download,
  Upload,
  Wand2,
  Send,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import {
  TriggerNode,
  MediaNode,
  AINode,
  ConditionNode,
  ActionNode,
  HandoverNode,
  WebhookNode,
  ButtonNode,
  InputNode,
} from "@/components/flow/FlowNodes";
import { DeletableEdge } from "@/components/flow/DeletableEdge";

type FlowDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  nodesJson: any[];
  edgesJson: any[];
};

type SimMessageItem = {
  id: string;
  sender: "user" | "bot";
  type?: "text" | "media" | "qris" | "handover" | "buttons";
  text?: string;
  caption?: string;
  mediaUrl?: string;
  buttons?: string[];
  timestamp: string;
};

export default function FlowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [flow, setFlow] = useState<FlowDetail | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [simMessages, setSimMessages] = useState<SimMessageItem[]>([
    {
      id: "init-1",
      sender: "bot",
      type: "text",
      text: "📱 *Simulasi WhatsApp Aktif.* Ketik pesan uji coba di bawah untuk menguji alur Anda!",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [simInput, setSimInput] = useState("");
  const [simulating, setSimulating] = useState(false);

  // Knowledge Base Media Picker State
  const [showMediaPickerModal, setShowMediaPickerModal] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState<
    Array<{ id: string; title: string; sourceType: string; fileUrl: string; updatedAt: string }>
  >([]);
  const [loadingMediaLibrary, setLoadingMediaLibrary] = useState(false);

  async function openMediaPicker() {
    setShowMediaPickerModal(true);
    setLoadingMediaLibrary(true);
    try {
      const list = await api<Array<{ id: string; title: string; sourceType: string; fileUrl: string; updatedAt: string }>>(
        "/knowledge/media",
      );
      setMediaLibrary(list);
    } catch {
      /* fallback empty */
    } finally {
      setLoadingMediaLibrary(false);
    }
  }

  const nodeTypes = useMemo(
    () => ({
      triggerNode: TriggerNode,
      trigger: TriggerNode,
      mediaNode: MediaNode,
      media: MediaNode,
      aiNode: AINode,
      ai: AINode,
      conditionNode: ConditionNode,
      condition: ConditionNode,
      actionNode: ActionNode,
      action: ActionNode,
      handoverNode: HandoverNode,
      handover: HandoverNode,
      webhookNode: WebhookNode,
      webhook: WebhookNode,
      buttonNode: ButtonNode,
      button: ButtonNode,
      inputNode: InputNode,
      input: InputNode,
    }),
    [],
  );

  const edgeTypes = useMemo(
    () => ({
      deletable: DeletableEdge,
      default: DeletableEdge,
    }),
    [],
  );

  const loadFlow = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<{ ok: boolean; data: FlowDetail }>(`/flows/${id}`);
      if (res.ok && res.data) {
        setFlow(res.data);
        const initialNodes = (res.data.nodesJson || []).map((n: any) => ({
          ...n,
          type: n.type || "triggerNode",
        }));
        const initialEdges = (res.data.edgesJson || []).map((e: any) => ({
          ...e,
          type: "deletable",
        }));
        setNodes(initialNodes);
        setEdges(initialEdges);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadFlow();
  }, [loadFlow]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: "deletable" }, eds)),
    [],
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    if (confirm("Apakah Anda ingin menghapus garis penghubung alur ini?")) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }
  }, []);

  const addNode = (type: string, label: string) => {
    const newNodeId = `${type}-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type,
      position: { x: 250 + Math.random() * 40, y: 150 + Math.random() * 40 },
      data: { label, triggerType: "all_messages", mediaType: "image", btn1: "Pilihan 1", varName: "user_input" },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  };

  const updateSelectedNodeData = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updated = {
            ...n,
            data: { ...n.data, [key]: value },
          };
          setSelectedNode(updated);
          return updated;
        }
        return n;
      }),
    );
  };

  // Auto-Tidy Layout Function
  const handleAutoTidyLayout = () => {
    if (nodes.length === 0) return;
    const startNode = nodes.find((n) => n.type?.includes("trigger")) || nodes[0];

    const visited = new Set<string>();
    const nodeLevels = new Map<string, number>();

    const assignLevel = (nodeId: string, level: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      nodeLevels.set(nodeId, level);

      const outEdges = edges.filter((e) => e.source === nodeId);
      outEdges.forEach((e) => assignLevel(e.target, level + 1));
    };

    assignLevel(startNode.id, 0);

    // Group nodes by level
    const levelGroups = new Map<number, Node[]>();
    nodes.forEach((node) => {
      const lvl = nodeLevels.get(node.id) ?? 0;
      const grp = levelGroups.get(lvl) || [];
      grp.push(node);
      levelGroups.set(lvl, grp);
    });

    // Re-calculate positions
    const tidyNodes = nodes.map((node) => {
      const lvl = nodeLevels.get(node.id) ?? 0;
      const grp = levelGroups.get(lvl) || [node];
      const idx = grp.findIndex((n) => n.id === node.id);

      const xCenter = 300;
      const xSpacing = 280;
      const xOffset = xCenter + (idx - (grp.length - 1) / 2) * xSpacing;
      const yOffset = 60 + lvl * 150;

      return {
        ...node,
        position: { x: xOffset, y: yOffset },
      };
    });

    setNodes(tidyNodes);
  };

  // Export JSON Flow file
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ name: flow?.name || "Flow", nodes, edges }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${flow?.name || "flow"}-export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON Flow file
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            setNodes(parsed.nodes);
            setEdges(parsed.edges.map((eg: any) => ({ ...eg, type: "deletable" })));
          }
        } catch {
          alert("File JSON tidak valid!");
        }
      };
    }
  };

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api(`/flows/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          nodesJson: nodes,
          edgesJson: edges,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  async function handleRunSimulation(e?: React.FormEvent, overrideText?: string) {
    if (e) e.preventDefault();
    const userText = overrideText || simInput;
    if (!userText.trim() || simulating) return;

    const timeNow = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    if (!overrideText) setSimInput("");

    setSimMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        type: "text",
        text: userText,
        timestamp: timeNow,
      },
    ]);
    setSimulating(true);

    try {
      const res = await api<{
        ok: boolean;
        executedNodeIds: string[];
        replies: Array<{
          type: "text" | "media" | "qris" | "handover" | "buttons";
          text?: string;
          caption?: string;
          mediaUrl?: string;
          buttons?: string[];
        }>;
      }>("/flows/simulate", {
        method: "POST",
        body: JSON.stringify({ nodes, edges, messageText: userText }),
      });

      if (res.ok) {
        setHighlightedNodeIds(res.executedNodeIds || []);
        if (res.replies && res.replies.length > 0) {
          const newReplies: SimMessageItem[] = res.replies.map((rep, index) => ({
            id: `bot-${Date.now()}-${index}`,
            sender: "bot",
            type: rep.type,
            text: rep.text,
            caption: rep.caption,
            mediaUrl: rep.mediaUrl,
            buttons: rep.buttons,
            timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          }));
          setSimMessages((prev) => [...prev, ...newReplies]);
        } else {
          setSimMessages((prev) => [
            ...prev,
            {
              id: `bot-${Date.now()}`,
              sender: "bot",
              type: "text",
              text: "Sistem: Tidak ada node yang cocok dengan pesan ini.",
              timestamp: timeNow,
            },
          ]);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setSimulating(false);
    }
  }

  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      const isExec = highlightedNodeIds.includes(node.id);
      return {
        ...node,
        style: isExec
          ? { ...node.style, filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.8))", transition: "all 0.3s ease" }
          : node.style,
        className: isExec
          ? `${node.className || ""} ring-4 ring-emerald-500 rounded-2xl animate-pulse`
          : node.className,
      };
    });
  }, [nodes, highlightedNodeIds]);

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-[var(--color-paper)] text-[var(--color-ink)]">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
          <p className="text-sm font-medium">Membuka Kanvas Flow Builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--color-paper)] text-[var(--color-ink)] overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="flex h-14 items-center justify-between border-b border-[var(--color-line)] bg-white px-5 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/settings/flows")}
            className="rounded-xl p-2 hover:bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[var(--color-ink)]">{flow?.name || "Flow Canvas"}</h2>
            <p className="text-xs text-[var(--color-muted)]">
              {nodes.length} Nodes · {edges.length} Connections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Disimpan!
            </span>
          )}
          <button
            onClick={handleAutoTidyLayout}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-2)] px-3 py-1.5 text-xs font-bold text-[var(--color-ink)] hover:bg-slate-200 transition-colors shadow-2xs"
          >
            <Wand2 className="h-3.5 w-3.5 text-purple-600" /> Rapikan Layout
          </button>
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Ekspor JSON
          </button>
          <label className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] cursor-pointer transition-colors">
            <Upload className="h-3.5 w-3.5" /> Impor JSON
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          <Button
            variant="secondary"
            onClick={() => setShowSimulator(!showSimulator)}
            className={`border-amber-500/30 ${
              showSimulator ? "bg-amber-100 text-amber-900 border-amber-400" : "text-amber-700 hover:bg-amber-50"
            }`}
          >
            📱 {showSimulator ? "Tutup" : "Live Simulator WA"}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Alur"}
          </Button>
        </div>
      </header>

      {/* Main Canvas Area + Sidebars */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar (Add Nodes) */}
        <aside className="w-60 border-r border-[var(--color-line)] bg-white p-4 space-y-4 z-10 flex flex-col justify-between shadow-xs overflow-y-auto">
          <div>
            <h3 className="text-[11px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-3">
              Tambah Node Grafik
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => addNode("triggerNode", "Pesan WA Masuk")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50/60 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100/60 transition-colors shadow-2xs"
              >
                <Zap className="h-4 w-4 text-emerald-600" /> + Trigger Node
              </button>
              <button
                onClick={() => addNode("buttonNode", "Pesan Tombol Pilihan")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-50/60 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100/60 transition-colors shadow-2xs"
              >
                <SlidersHorizontal className="h-4 w-4 text-cyan-600" /> + WA Buttons Node
              </button>
              <button
                onClick={() => addNode("inputNode", "Minta Input Pembeli")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-orange-500/30 bg-orange-50/60 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100/60 transition-colors shadow-2xs"
              >
                <FormInput className="h-4 w-4 text-orange-600" /> + Capture Input Node
              </button>
              <button
                onClick={() => addNode("mediaNode", "Kirim Foto Brosur")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-sky-500/30 bg-sky-50/60 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100/60 transition-colors shadow-2xs"
              >
                <Image className="h-4 w-4 text-sky-600" /> + Media Node (Foto/PDF)
              </button>
              <button
                onClick={() => addNode("aiNode", "AI RAG Search & Auto-Photo")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-purple-500/30 bg-purple-50/60 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100/60 transition-colors shadow-2xs"
              >
                <Bot className="h-4 w-4 text-purple-600" /> + AI RAG Search Node
              </button>
              <button
                onClick={() => addNode("conditionNode", "Percabangan Logika")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-50/60 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100/60 transition-colors shadow-2xs"
              >
                <GitBranch className="h-4 w-4 text-amber-600" /> + Condition Node
              </button>
              <button
                onClick={() => addNode("actionNode", "Buat Invoice / QRIS")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-teal-500/30 bg-teal-50/60 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100/60 transition-colors shadow-2xs"
              >
                <CreditCard className="h-4 w-4 text-teal-600" /> + Action Node (B1/B2)
              </button>
              <button
                onClick={() => addNode("handoverNode", "Alihkan ke CS Manusia")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-50/60 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100/60 transition-colors shadow-2xs"
              >
                <UserCheck className="h-4 w-4 text-rose-600" /> + Handover Node
              </button>
              <button
                onClick={() => addNode("webhookNode", "Google Sheets POST")}
                className="w-full flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-50/60 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100/60 transition-colors shadow-2xs"
              >
                <Globe className="h-4 w-4 text-indigo-600" /> + Webhook Node
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-2)] p-3 text-xs text-[var(--color-muted)] space-y-1.5">
            <p className="font-bold text-[var(--color-ink)]">💡 Tips Kanvas:</p>
            <p>• Klik tombol merah <b>×</b> pada garis untuk menghapus penghubung.</p>
            <p>• Klik <b>Rapikan Layout</b> di atas untuk menyusun node otomatis.</p>
          </div>
        </aside>

        {/* Center React Flow Canvas */}
        <main className="flex-1 h-full w-full bg-[var(--color-paper)] relative">
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            deleteKeyCode={["Backspace", "Delete"]}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
          >
            <Controls className="!bg-white !border-[var(--color-line)] !text-[var(--color-ink)] !shadow-sm" />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
          </ReactFlow>
        </main>

        {/* Right Inspector Drawer (Node Property Editor) */}
        {selectedNode && (
          <aside className="w-80 border-l border-[var(--color-line)] bg-white p-5 z-10 space-y-4 overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">Edit Property Node</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-xs text-[var(--color-muted)] hover:text-black font-semibold"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">Label Node</label>
                <input
                  type="text"
                  value={String(selectedNode.data?.label ?? "")}
                  onChange={(e) => updateSelectedNodeData("label", e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Trigger Node Inspector */}
              {selectedNode.type?.includes("trigger") && (
                <>
                  <div>
                    <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">Tipe Trigger</label>
                    <select
                      value={String(selectedNode.data?.triggerType ?? "all_messages")}
                      onChange={(e) => updateSelectedNodeData("triggerType", e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                    >
                      <option value="all_messages">Semua Pesan WA Masuk</option>
                      <option value="keyword">Pencocokan Kata Kunci Spesifik</option>
                    </select>
                  </div>
                  {selectedNode.data?.triggerType === "keyword" && (
                    <div>
                      <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">Kata Kunci (pisah koma)</label>
                      <input
                        type="text"
                        placeholder="promo,harga,menu,halo"
                        value={String(selectedNode.data?.keywords ?? "")}
                        onChange={(e) => updateSelectedNodeData("keywords", e.target.value)}
                        className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                      />
                    </div>
                  )}
                </>
              )}

              {/* WA Buttons Node Inspector */}
              {selectedNode.type?.includes("button") && (
                <>
                  <div>
                    <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">Tombol Pilihan 1</label>
                    <input
                      type="text"
                      placeholder="Beli Sekarang"
                      value={String(selectedNode.data?.btn1 ?? "")}
                      onChange={(e) => updateSelectedNodeData("btn1", e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">Tombol Pilihan 2 (opsional)</label>
                    <input
                      type="text"
                      placeholder="Tanya CS Manusia"
                      value={String(selectedNode.data?.btn2 ?? "")}
                      onChange={(e) => updateSelectedNodeData("btn2", e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                    />
                  </div>
                </>
              )}

              {/* Input Variable Node Inspector */}
              {selectedNode.type?.includes("input") && (
                <div>
                  <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">Nama Variabel Simpan</label>
                  <input
                    type="text"
                    placeholder="nama_pembeli"
                    value={String(selectedNode.data?.varName ?? "")}
                    onChange={(e) => updateSelectedNodeData("varName", e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none font-mono"
                  />
                  <p className="text-[11px] text-[var(--color-muted)] mt-1">Dapat dipanggil sebagai <code>{`{{${selectedNode.data?.varName || "var"}}}`}</code> di node berikutnya.</p>
                </div>
              )}

              {/* Media Node Inspector */}
              {selectedNode.type?.includes("media") && (
                <>
                  <div>
                    <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">Tipe Media</label>
                    <select
                      value={String(selectedNode.data?.mediaType ?? "image")}
                      onChange={(e) => updateSelectedNodeData("mediaType", e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                    >
                      <option value="image">Gambar / Foto (JPG/PNG)</option>
                      <option value="document">Dokumen / PDF Katalog</option>
                      <option value="video">Video (MP4)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">URL File Media</label>
                    <input
                      type="url"
                      placeholder="https://domain.com/katalog.pdf"
                      value={String(selectedNode.data?.mediaUrl ?? "")}
                      onChange={(e) => updateSelectedNodeData("mediaUrl", e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void openMediaPicker()}
                      className="w-full mt-2 rounded-xl border border-sky-300 bg-sky-50 py-2 text-center text-xs font-bold text-sky-800 hover:bg-sky-100 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      📁 Pilih dari Knowledge Base
                    </button>
                  </div>
                  <div>
                    <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">Caption Pesan</label>
                    <textarea
                      rows={3}
                      placeholder="Teks keterangan foto/video..."
                      value={String(selectedNode.data?.caption ?? "")}
                      onChange={(e) => updateSelectedNodeData("caption", e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                    />
                  </div>
                </>
              )}

              {/* AI Node Inspector */}
              {selectedNode.type?.includes("ai") && (
                <div>
                  <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">System Prompt Tambahan</label>
                  <textarea
                    rows={4}
                    placeholder="Instruksi spesifik AI..."
                    value={String(selectedNode.data?.systemPrompt ?? "")}
                    onChange={(e) => updateSelectedNodeData("systemPrompt", e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                  />
                </div>
              )}

              {/* Webhook Node Inspector */}
              {selectedNode.type?.includes("webhook") && (
                <div>
                  <label className="block text-[var(--color-ink-soft)] mb-1 font-semibold">URL Endpoint Webhook (HTTP POST)</label>
                  <input
                    type="url"
                    placeholder="https://script.google.com/..."
                    value={String(selectedNode.data?.webhookUrl ?? "")}
                    onChange={(e) => updateSelectedNodeData("webhookUrl", e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-ink)] outline-none"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-[var(--color-line)]">
                <button
                  onClick={() => {
                    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                    setSelectedNode(null);
                  }}
                  className="w-full rounded-xl bg-rose-50 py-2.5 text-center font-bold text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors"
                >
                  Hapus Node Ini
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Knowledge Base Media Picker Modal */}
        {showMediaPickerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📁</span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Pilih File Media Knowledge Base</h3>
                    <p className="text-xs text-slate-500">Pilih foto/PDF brosur yang telah diunggah di Knowledge Base</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMediaPickerModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loadingMediaLibrary ? (
                  <p className="py-8 text-center text-xs text-slate-500 animate-pulse">Memuat berkas media...</p>
                ) : mediaLibrary.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Belum ada file foto/PDF di Knowledge Base.</p>
                    <p className="text-[11px] text-slate-500">Silakan unggah brosur/foto terlebih dahulu di menu Knowledge Base.</p>
                  </div>
                ) : (
                  mediaLibrary.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        updateSelectedNodeData("mediaUrl", item.fileUrl);
                        if (!selectedNode?.data?.caption) {
                          updateSelectedNodeData("caption", item.title);
                        }
                        setShowMediaPickerModal(false);
                      }}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-sky-500 hover:bg-sky-50/60 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700 font-bold text-xs uppercase">
                          {item.sourceType === "pdf" ? "PDF" : "IMG"}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 group-hover:text-sky-900">{item.title}</h4>
                          <p className="text-[11px] text-slate-400 truncate max-w-[320px]">{item.fileUrl}</p>
                        </div>
                      </div>
                      <span className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-bold text-white shadow-2xs group-hover:bg-sky-700">
                        Pilih
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowMediaPickerModal(false)}>
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Live Simulator WA Drawer */}
        {showSimulator && (
          <aside className="absolute bottom-5 right-5 w-88 h-[500px] border border-[#075e54]/30 bg-white rounded-2xl shadow-2xl z-20 flex flex-col overflow-hidden font-sans">
            {/* WhatsApp Header */}
            <div className="flex items-center justify-between bg-[#075e54] px-4 py-2.5 text-white">
              <div className="flex items-center gap-2.5 text-xs font-bold">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-sm">
                  WA
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#075e54]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">WhatsApp Business</h4>
                  <p className="text-[10px] text-emerald-200 font-normal">Online · Respon Otomatis</p>
                </div>
              </div>
              <button
                onClick={() => setShowSimulator(false)}
                className="text-xs text-emerald-100 hover:text-white font-bold bg-emerald-800/40 px-2 py-1 rounded-lg"
              >
                Tutup
              </button>
            </div>

            {/* WhatsApp Chat Body Wallpaper */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-[#efeae2]">
              {simMessages.map((msg) => {
                const isUser = msg.sender === "user";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
                  >
                    <div
                      className={`max-w-[88%] rounded-xl p-3 leading-relaxed shadow-xs relative ${
                        isUser
                          ? "bg-[#dcf8c6] text-[#111b21] rounded-tr-none border border-emerald-200"
                          : "bg-white text-[#111b21] rounded-tl-none border border-slate-200"
                      }`}
                    >
                      {/* Media Image Card */}
                      {msg.type === "media" && (
                        <div className="mb-2 space-y-1.5">
                          <div className="h-28 w-full rounded-lg bg-sky-100 border border-sky-200 flex flex-col items-center justify-center text-sky-700 font-medium">
                            <Image className="h-6 w-6 text-sky-600 mb-1" />
                            <span className="text-[11px] font-bold">Foto Produk / PDF Katalog</span>
                          </div>
                          {msg.caption && (
                            <p className="text-xs text-[var(--color-ink)]">{msg.caption}</p>
                          )}
                        </div>
                      )}

                      {/* QRIS / Payment Card */}
                      {msg.type === "qris" && (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-teal-200 bg-teal-50 p-2.5 text-teal-800 space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">💳 QRIS & Invoice Midtrans B2</p>
                            <p className="text-xs">{msg.text}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRunSimulation(undefined, "sudah bayar")}
                            className="w-full rounded-lg bg-emerald-600 py-1.5 text-center font-bold text-white shadow-2xs hover:bg-emerald-700 text-[11px]"
                          >
                            📲 Simulasikan Bayar QRIS Instan
                          </button>
                        </div>
                      )}

                      {/* Handover Alert Card */}
                      {msg.type === "handover" && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-900 font-semibold text-xs flex items-center gap-2">
                          <span className="text-base">🔔</span>
                          <span>{msg.text}</span>
                        </div>
                      )}

                      {/* Standard Formatted Text Message */}
                      {msg.text && msg.type !== "qris" && msg.type !== "handover" && (
                        <div
                          className="whitespace-pre-wrap leading-relaxed text-xs"
                          dangerouslySetInnerHTML={{
                            __html: msg.text
                              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                              .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
                              .replace(/_(.*?)_/g, "<em>$1</em>"),
                          }}
                        />
                      )}

                      {/* Interactive Buttons (Quick Reply Pills) */}
                      {msg.type === "buttons" && msg.buttons && msg.buttons.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200 space-y-1.5">
                          {msg.buttons.map((btnText, bIdx) => (
                            <button
                              key={bIdx}
                              type="button"
                              onClick={() => void handleRunSimulation(undefined, btnText)}
                              className="w-full rounded-lg border border-cyan-400/50 bg-cyan-50 py-1.5 px-3 text-center text-xs font-bold text-cyan-800 hover:bg-cyan-100 transition-colors flex items-center justify-center gap-1.5"
                            >
                              🔘 {btnText}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Timestamp & Read Indicator */}
                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1">
                        <span>{msg.timestamp}</span>
                        {isUser && <span className="text-sky-500 font-bold">✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Form Input Pesan WA */}
            <form
              onSubmit={(e) => void handleRunSimulation(e)}
              className="p-2.5 bg-[#f0f2f5] border-t border-slate-300 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ketik pesan WhatsApp..."
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[#111b21] outline-none focus:border-emerald-600 text-xs"
              />
              <button
                type="submit"
                disabled={simulating}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#075e54] text-white hover:bg-emerald-800 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
