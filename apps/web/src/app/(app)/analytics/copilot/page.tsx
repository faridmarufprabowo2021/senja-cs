"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Flame,
  HelpCircle,
  BarChart3,
  User,
  Zap,
  CheckCircle2,
  Loader2,
  Users,
} from "lucide-react";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { FormattedMarkdown } from "@/components/FormattedMarkdown";

type RecommendedContact = {
  contactId: string;
  name: string;
  phone: string;
  intent: "hot" | "warm" | "cold" | "converted";
  reason: string;
  lastMessage?: string;
};

type RecommendedAction = {
  id: string;
  actionType: "contextual_followup" | "send_booking_reminder" | "send_payment_link";
  title: string;
  description: string;
  targetContacts: { id: string; name: string; phone: string }[];
};

type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: RecommendedContact[];
  actions?: RecommendedAction[];
  createdAt: string;
};

type CopilotSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
};

const PRESET_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Kondisi Pipeline Lead",
    prompt: "Bagaimana statistik & kesehatan pipeline lead toko saya saat ini?",
    color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  },
  {
    icon: Flame,
    label: "HOT Leads Wajib Dikejar",
    prompt: "Siapa saja calon pembeli dengan minat paling tinggi (HOT) yang paling layak dikejar minggu ini?",
    color: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
  },
  {
    icon: AlertTriangle,
    label: "Lead Macet / Overdue",
    prompt: "Lead mana saja yang paling lama tertahan/macet tanpa balasan dan berisiko hilang?",
    color: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
  },
  {
    icon: HelpCircle,
    label: "Keberatan / Alasan Batal",
    prompt: "Apa saja keberatan atau alasan customer paling sering batal membeli berdasarkan percakapan terbaru?",
    color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
  },
];

export default function CrmCopilotPage() {
  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Track Action Execution status per action.id
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [actionStatuses, setActionStatuses] = useState<Record<string, { status: "success" | "error"; message: string }>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    try {
      const data = await api<CopilotSession[]>("/crm-copilot/sessions");
      setSessions(data || []);
      if (data && data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (err) {
      console.warn("Gagal memuat sesi copilot", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const data = await api<{ messages: CopilotMessage[] }>(
        `/crm-copilot/sessions/${sessionId}`,
      );
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          recommendations: m.metadata?.recommendations || [],
          actions: m.metadata?.actions || [],
          createdAt: m.createdAt,
        })),
      );
    } catch (err) {
      console.warn("Gagal memuat pesan copilot", err);
    }
  };

  useEffect(() => {
    void fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      void fetchMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleCreateSession = async () => {
    try {
      const newSession = await api<CopilotSession>("/crm-copilot/sessions", {
        method: "POST",
      });
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
    } catch (err) {
      console.warn("Gagal membuat sesi baru", err);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api(`/crm-copilot/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.warn("Gagal menghapus sesi", err);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const query = (customPrompt || inputPrompt).trim();
    if (!query || loading) return;

    setInputPrompt("");
    setLoading(true);

    const tempUserMsg: CopilotMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await api<{
        sessionId: string;
        messageId: string;
        content: string;
        recommendations: RecommendedContact[];
        actions?: RecommendedAction[];
        createdAt: string;
      }>("/crm-copilot/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId: activeSessionId || undefined,
          prompt: query,
        }),
      });

      if (!activeSessionId) {
        setActiveSessionId(res.sessionId);
        void fetchSessions();
      }

      const botMsg: CopilotMessage = {
        id: res.messageId,
        role: "assistant",
        content: res.content,
        recommendations: res.recommendations || [],
        actions: res.actions || [],
        createdAt: res.createdAt,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "❌ Terjadi kendala saat menganalisis data. Silakan coba kembali.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (action: RecommendedAction) => {
    setExecutingActionId(action.id);
    try {
      const contactIds = action.targetContacts.map((c) => c.id);
      const res = await api<{ ok: boolean; executedCount: number; details: string }>(
        "/crm-copilot/execute-action",
        {
          method: "POST",
          body: JSON.stringify({
            actionType: action.actionType,
            contactIds,
          }),
        },
      );

      if (res.ok) {
        setActionStatuses((prev) => ({
          ...prev,
          [action.id]: {
            status: "success",
            message: `✅ Berhasil! ${res.details}`,
          },
        }));
      } else {
        setActionStatuses((prev) => ({
          ...prev,
          [action.id]: {
            status: "error",
            message: `❌ ${res.details || "Gagal mengesksekusi tindakan AI"}`,
          },
        }));
      }
    } catch (err) {
      setActionStatuses((prev) => ({
        ...prev,
        [action.id]: {
          status: "error",
          message: err instanceof Error ? `❌ ${err.message}` : "❌ Gagal eksekusi",
        },
      }));
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-50 lg:flex-row">
      {/* Left Sidebar: Sessions History */}
      <div className="w-full border-r border-[var(--color-line)] bg-white p-4 lg:w-72 lg:flex-shrink-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[var(--color-accent)]" />
            <h2 className="text-sm font-bold text-[var(--color-ink)]">
              Riwayat Analisis
            </h2>
          </div>
          <Button
            size="sm"
            onClick={handleCreateSession}
            className="h-8 gap-1 px-2.5 text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            Baru
          </Button>
        </div>

        <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {loadingSessions ? (
            <p className="p-3 text-xs text-[var(--color-muted)]">Memuat riwayat...</p>
          ) : sessions.length === 0 ? (
            <p className="p-3 text-xs text-[var(--color-muted)]">
              Belum ada riwayat analisis. Klik &quot;+ Baru&quot; untuk memulai.
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition ${
                  activeSessionId === s.id
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                  <span className="truncate text-xs">{s.title}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => void handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition"
                  title="Hapus Sesi"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Chat & Analysis Feed */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-[var(--color-line)] bg-white px-6 py-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[var(--color-ink)]">
                CRM Analis by AI
              </h1>
              <Badge tone="accent" className="font-mono text-[10px] uppercase">
                Copilot Pemilik Bisnis
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              Konsultasikan kesehatan pipeline, HOT leads, alasan gagal closing, &amp; eksekusi tindakan WA otomatis.
            </p>
          </div>
          <Link href="/analytics">
            <Button variant="secondary" size="sm" className="gap-1 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Lihat Grafik Analitik
            </Button>
          </Link>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl text-center py-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-[var(--color-ink)]">
                Mau tahu apa soal CRM toko kamu hari ini?
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)] max-w-md mx-auto">
                Pilih salah satu pertanyaan cepat di bawah ini atau ketikkan pertanyaan analitis Anda sendiri secara bebas.
              </p>

              {/* Preset Chips */}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {PRESET_PROMPTS.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void handleSend(p.prompt)}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition shadow-xs ${p.color}`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs">{p.label}</div>
                        <div className="mt-0.5 text-[11px] opacity-80 leading-relaxed">
                          &quot;{p.prompt}&quot;
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white shadow-xs">
                    <Bot className="h-5 w-5" />
                  </div>
                )}

                <div
                  className={`max-w-3xl rounded-2xl p-4 shadow-xs ${
                    m.role === "user"
                      ? "bg-[var(--color-accent)] text-white font-medium"
                      : "bg-white border border-[var(--color-line)] text-slate-800"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <FormattedMarkdown content={m.content} />
                  ) : (
                    <div className="whitespace-pre-wrap text-xs leading-relaxed font-sans font-medium">
                      {m.content}
                    </div>
                  )}

                  {/* 1-Click Autonomous Action Boxes */}
                  {m.role === "assistant" && m.actions && m.actions.length > 0 ? (
                    <div className="mt-4 border-t border-slate-200/80 pt-3 space-y-3">
                      {m.actions.map((act) => {
                        const statusObj = actionStatuses[act.id];
                        const isExecuting = executingActionId === act.id;

                        return (
                          <div
                            key={act.id}
                            className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <div className="p-1.5 rounded-lg bg-emerald-600 text-white mt-0.5">
                                  <Zap className="h-4 w-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                                    <span>{act.title}</span>
                                    <span className="text-[10px] font-mono font-normal bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full">
                                      🧠 Personal &amp; Berbasis Konteks
                                    </span>
                                  </h4>
                                  <p className="mt-1 text-[11px] text-emerald-800 leading-relaxed">
                                    {act.description}
                                  </p>

                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <Users className="h-3 w-3 text-emerald-700" />
                                    <span className="text-[10px] font-semibold text-emerald-900">
                                      Target ({act.targetContacts.length}):
                                    </span>
                                    {act.targetContacts.slice(0, 4).map((tc) => (
                                      <span
                                        key={tc.id}
                                        className="rounded-md bg-white border border-emerald-300 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900"
                                      >
                                        {tc.name}
                                      </span>
                                    ))}
                                    {act.targetContacts.length > 4 && (
                                      <span className="text-[10px] text-emerald-700">
                                        +{act.targetContacts.length - 4} lainnya
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex-shrink-0">
                                {statusObj ? (
                                  <div
                                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                                      statusObj.status === "success"
                                        ? "bg-emerald-600 text-white"
                                        : "bg-rose-600 text-white"
                                    }`}
                                  >
                                    {statusObj.status === "success" && (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    <span>{statusObj.message}</span>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    disabled={isExecuting}
                                    onClick={() => void handleExecuteAction(act)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                                  >
                                    {isExecuting ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>Menyusun &amp; Kirim WA...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="h-3.5 w-3.5 fill-current" />
                                        <span>⚡ Eksekusi Follow-Up AI Personal</span>
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Recommendations Cards Grid */}
                  {m.role === "assistant" &&
                  m.recommendations &&
                  m.recommendations.length > 0 ? (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Flame className="h-4 w-4 text-amber-500" />
                        <span>Kontak Rekomendasi Siap Dihubungi:</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {m.recommendations.map((rec) => (
                          <div
                            key={rec.contactId}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {rec.name}
                                </span>
                                <Badge
                                  tone={rec.intent === "hot" ? "warn" : "accent"}
                                  className="text-[9px] uppercase font-mono"
                                >
                                  {rec.intent}
                                </Badge>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">
                                {rec.reason || rec.lastMessage}
                              </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-200/60 flex justify-end">
                              <Link href={`/inbox?contactId=${rec.contactId}`}>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-[10px] font-bold gap-1 bg-white hover:bg-slate-100"
                                >
                                  Chat Sekarang
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {m.role === "user" && (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white animate-pulse">
                <Bot className="h-5 w-5" />
              </div>
              <div className="rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-xs text-slate-500 font-medium">
                AI sedang menganalisis database &amp; menyusun wawasan CRM...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Bar */}
        <div className="border-t border-[var(--color-line)] bg-white p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Tanyakan sesuatu tentang prospek, closing, atau eksekusi tindakan WA..."
              disabled={loading}
              className="flex-1 rounded-xl border border-[var(--color-line)] bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-[var(--color-accent)] focus:bg-white transition"
            />
            <Button
              type="submit"
              disabled={!inputPrompt.trim() || loading}
              className="gap-1 px-4 text-xs font-bold"
            >
              <Send className="h-3.5 w-3.5" />
              Kirim
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
