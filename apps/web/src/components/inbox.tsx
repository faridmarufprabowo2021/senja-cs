"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Bot,
  CheckCheck,
  ExternalLink,
  Hand,
  MoreHorizontal,
  Paperclip,
  PhoneCall,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, ConversationStatus, Message } from "@cs/shared";
import { STATUS_LABEL } from "@cs/shared";
import {
  avatarGradient,
  cn,
  formatRelative,
  formatTime,
  initials,
} from "@/lib/utils";
import { api, mediaUrl } from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";
import { Badge, Button, Input, StatusDot } from "./ui";

const PRESET_TAGS = ["baru", "hot", "komplain", "order", "followup"];

const filters: { id: "all" | ConversationStatus | "mine"; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "waiting_agent", label: "Menunggu" },
  { id: "bot_active", label: "Bot" },
  { id: "mine", label: "Saya" },
  { id: "resolved", label: "Selesai" },
];

function statusTone(status: ConversationStatus) {
  if (status === "waiting_agent") return "warn" as const;
  if (status === "bot_active") return "bot" as const;
  if (status === "assigned") return "human" as const;
  if (status === "resolved") return "success" as const;
  return "default" as const;
}

function MessageBubble({
  message,
  onInspectAiSource,
  onEvaluateBotMessage,
}: {
  message: Message;
  onInspectAiSource?: (meta: NonNullable<Message["metadata"]>["aiSource"]) => void;
  onEvaluateBotMessage?: (msg: Message) => void;
}) {
  if (message.senderType === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-2)] px-3 py-1 text-[11px] text-[var(--color-muted)]">
          {message.body}
        </span>
      </div>
    );
  }

  const mine = message.direction === "out";
  const isBot = message.senderType === "bot";
  const aiSource = message.metadata?.aiSource;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn("flex", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
          mine
            ? isBot
              ? "rounded-br-md border border-[#c9d8f8] bg-[var(--color-bot-soft)]"
              : "rounded-br-md border border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
            : "rounded-bl-md border border-[var(--color-line)] bg-white",
        )}
      >
        {mine && message.senderName ? (
          <div
            className={cn(
              "mb-1 flex items-center justify-between gap-1.5 text-[11px]",
              isBot ? "text-[var(--color-bot)] font-semibold" : "text-white/80",
            )}
          >
            <div className="flex items-center gap-1.5">
              {isBot ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
              {message.senderName}
            </div>
            {isBot && onEvaluateBotMessage ? (
              <button
                type="button"
                onClick={() => onEvaluateBotMessage(message)}
                className="text-[10px] font-medium text-purple-700 hover:text-purple-900 bg-purple-100/80 hover:bg-purple-200/90 px-1.5 py-0.5 rounded-md transition-all flex items-center gap-1"
                title="Koreksi balasan AI ini agar AI belajar jawaban yang benar"
              >
                ✏️ Koreksi AI
              </button>
            ) : null}
          </div>
        ) : null}
        {message.metadata?.mediaUrl &&
        (message.type === "image" ||
          message.metadata.mimeType?.startsWith("image/")) ? (
          <div className="mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(message.metadata.mediaUrl)}
              alt={message.body || "gambar"}
              className="max-h-56 max-w-full rounded-xl object-contain"
            />
            {message.metadata?.imageAnalysis ? (
              <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-blue-50/90 border border-blue-200 px-2 py-1 text-[11px] text-blue-800 font-medium">
                <span>👁️ AI Vision:</span>
                <span className="truncate">{message.metadata.imageAnalysis}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {message.metadata?.mediaUrl && message.type === "audio" ? (
          <div className="mb-2 p-2 rounded-xl bg-purple-50/80 border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-purple-800">🎙️ Pesan Suara</span>
            </div>
            <audio
              controls
              src={mediaUrl(message.metadata.mediaUrl)}
              className="w-full max-w-[240px] h-8"
            />
          </div>
        ) : null}
        {message.type === "call_summary" || message.metadata?.callSummary ? (
          <div className="mb-2 p-3 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border border-indigo-200/80 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-indigo-200/60 pb-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                <PhoneCall className="h-4 w-4 text-indigo-600" />
                <span>
                  {message.metadata?.callSummary?.isMissedCall
                    ? "📞 Panggilan Tak Terjawab"
                    : "📞 WhatsApp Call AI Summary"}
                </span>
              </div>
              {message.metadata?.callSummary?.durationSec ? (
                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                  {Math.floor(message.metadata.callSummary.durationSec / 60)}m{" "}
                  {message.metadata.callSummary.durationSec % 60}s
                </span>
              ) : null}
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-bold text-indigo-950 block mb-0.5">📝 Ringkasan AI:</span>
                <p className="text-indigo-900 leading-snug">
                  {message.metadata?.callSummary?.summary || message.body}
                </p>
              </div>

              {message.metadata?.callSummary?.keyTakeaways?.length ? (
                <div>
                  <span className="font-bold text-indigo-950 block mb-0.5">📌 Poin-Poin Penting:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-indigo-800 text-[11px]">
                    {message.metadata.callSummary.keyTakeaways.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {message.metadata?.callSummary?.actionItems?.length ? (
                <div>
                  <span className="font-bold text-indigo-950 block mb-0.5">⚡ Tindakan Lanjutan:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-purple-900 text-[11px] font-medium">
                    {message.metadata.callSummary.actionItems.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {message.metadata?.mediaUrl && message.type === "document" ? (
          <a
            href={mediaUrl(message.metadata.mediaUrl)}
            target="_blank"
            rel="noreferrer"
            className="mb-2 block text-xs underline"
          >
            {message.metadata.fileName || "Unduh dokumen"}
          </a>
        ) : null}
        {message.type !== "call_summary" ? (
          <p className="whitespace-pre-wrap">{message.body}</p>
        ) : null}
        {message.metadata?.escalateReason ? (
          <div className="mt-1.5 text-[10px] text-[var(--color-warn)]">
            Handoff: {message.metadata.escalateReason}
            {message.metadata.skill ? ` · ${message.metadata.skill}` : ""}
            {message.metadata.preferredRole
              ? ` → ${message.metadata.preferredRole}`
              : ""}
          </div>
        ) : null}

        {/* AI Source Button & Citations */}
        {aiSource && aiSource.chunks?.length ? (
          <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onInspectAiSource?.(aiSource)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/80 bg-emerald-50/90 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-all shadow-2xs"
            >
              <Sparkles className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span>AI Source ({aiSource.chunks.length} RAG Source)</span>
            </button>
            {onEvaluateBotMessage ? (
              <button
                type="button"
                onClick={() => onEvaluateBotMessage(message)}
                className="text-[10px] font-semibold text-purple-700 hover:underline"
              >
                ✏️ Ajarkan AI
              </button>
            ) : null}
          </div>
        ) : message.metadata?.citations?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.metadata.citations.map((c, i) => (
              <span
                key={`${c.title}-${c.score}-${i}`}
                className="inline-flex items-center gap-1 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
              >
                <Sparkles className="h-2.5 w-2.5 text-[var(--color-accent)]" />
                {c.title}
              </span>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            "mt-1.5 flex items-center justify-end gap-1 text-[10px]",
            mine && !isBot ? "text-white/70" : "text-[var(--color-faint)]",
          )}
        >
          {message.metadata?.confidence != null ? (
            <span className="mr-1">
              conf {(message.metadata.confidence * 100).toFixed(0)}%
            </span>
          ) : null}
          {formatTime(message.createdAt)}
          {mine ? (
            <CheckCheck
              className={cn(
                "h-3 w-3",
                isBot ? "text-[var(--color-bot)]" : "text-white/80",
              )}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function AiSourceModal({
  source,
  onClose,
}: {
  source: NonNullable<Message["metadata"]>["aiSource"];
  onClose: () => void;
}) {
  if (!source) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-100 grid place-items-center text-emerald-700 shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--color-ink)]">AI Source Inspector</h3>
              <p className="text-[11px] text-[var(--color-muted)]">RAG Knowledge Base & Score Tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
            <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
              Query Pelanggan
            </span>
            <p className="font-medium text-slate-800 italic">"{source.query}"</p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200/60 pt-1.5">
              <span>Engine: {source.engine}</span>
              <span>{new Date(source.retrievedAt).toLocaleTimeString("id-ID")}</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-xs text-slate-700 block">
              Dokumen RAG Terkait ({source.chunks?.length || 0})
            </span>

            {source.chunks?.map((chunk, idx) => {
              const scorePct = Math.round(chunk.score * 100);
              return (
                <div key={chunk.id || idx} className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5 truncate">
                      <BookOpen className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      {chunk.title}
                    </span>
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs shrink-0">
                      {scorePct}% Relevan
                    </span>
                  </div>

                  <div className="rounded-lg bg-white p-2.5 border border-emerald-100 text-slate-700 leading-relaxed text-[11px] font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                    "{chunk.snippet}"
                  </div>

                  <div className="flex justify-end pt-1">
                    <a
                      href="/knowledge"
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      ✏️ Edit Dokumen di Knowledge Base
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex justify-end">
          <Button size="sm" onClick={onClose}>Tutup</Button>
        </div>
      </motion.div>
    </div>
  );
}

function AiEvaluationModal({
  message,
  onClose,
}: {
  message: Message | null;
  onClose: () => void;
}) {
  const [correctedText, setCorrectedText] = useState("");
  const [rating, setRating] = useState(1);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!message) return null;

  const userQuery = message.metadata?.aiSource?.query || "Pertanyaan pelanggan";

  async function handleSubmit() {
    if (!message || !correctedText.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await api("/evaluations", {
        method: "POST",
        body: JSON.stringify({
          conversationId: message.conversationId,
          messageId: message.id,
          userQuery,
          originalBotReply: message.body,
          correctedReply: correctedText.trim(),
          rating,
          feedbackNote: feedbackNote.trim() || undefined,
        }),
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan koreksi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-purple-100 grid place-items-center text-purple-700 shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--color-ink)]">✏️ Koreksi & Ajarkan AI</h3>
              <p className="text-[11px] text-[var(--color-muted)]">Supervised Real-Time Learning Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center font-bold text-lg">
              ✓
            </div>
            <h4 className="font-bold text-base text-emerald-800">Koreksi Berhasil Disimpan!</h4>
            <p className="text-xs text-slate-600">AI telah menyerap perbaikan ini dan meng-update Knowledge Base RAG secara real-time.</p>
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
                Konteks Pertanyaan Pelanggan
              </span>
              <p className="font-medium text-slate-800 italic">"{userQuery}"</p>
            </div>

            <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3 text-xs space-y-1">
              <span className="font-semibold text-rose-700 uppercase text-[10px] tracking-wider block">
                Jawaban Bot Saat Ini (Kurang Tepat / Salah)
              </span>
              <p className="text-rose-900 leading-relaxed font-mono">"{message.body}"</p>
            </div>

            <div>
              <label className="font-bold text-xs text-slate-700 block mb-1.5">
                Jawaban Benar yang Seharusnya (Untuk Diajarkan ke AI) *
              </label>
              <textarea
                value={correctedText}
                onChange={(e) => setCorrectedText(e.target.value)}
                rows={3}
                placeholder="Tuliskan jawaban yang benar di sini. AI akan mengingat instruksi ini untuk pertanyaan serupa di masa mendatang..."
                className="w-full rounded-xl border border-[var(--color-line)] p-3 text-xs outline-none focus:border-[var(--color-accent)] font-medium leading-relaxed"
              />
            </div>

            <div>
              <label className="font-semibold text-xs text-slate-700 block mb-1">
                Catatan Supervisor (Opsional)
              </label>
              <Input
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                placeholder="Contoh: Perubahan jam operasional per 2026..."
              />
            </div>

            {error ? <p className="text-xs text-rose-600">{error}</p> : null}

            <div className="mt-4 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Auto-injects to RAG pgvector</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>Batal</Button>
                <Button size="sm" onClick={handleSubmit} disabled={!correctedText.trim() || submitting}>
                  {submitting ? "Menyimpan..." : "Simpan & Ajarkan AI"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function InboxView() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeId, setActiveId] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [waSessions, setWaSessions] = useState<Array<{ id: string; name: string; phoneNumber?: string }>>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [selectedAiSource, setSelectedAiSource] = useState<NonNullable<Message["metadata"]>["aiSource"] | null>(null);
  const [evaluatingMessage, setEvaluatingMessage] = useState<Message | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === "mine") params.set("assignee", "me");
      else if (filter !== "all") params.set("status", filter);
      if (query.trim()) params.set("search", query.trim());
      const qs = params.toString();
      const data = await api<Conversation[]>(
        `/conversations${qs ? `?${qs}` : ""}`,
      );
      setItems(data);
      setActiveId((prev) => prev || data[0]?.id || "");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat inbox");
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  const loadMessages = useCallback(async (id: string) => {
    if (!id) {
      setMessages([]);
      return;
    }
    try {
      const data = await api<Message[]>(`/conversations/${id}/messages`);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pesan");
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    api<{ quickReplies?: string[] }>("/bot/settings")
      .then((s) => setQuickReplies(s.quickReplies ?? []))
      .catch(() => setQuickReplies([]));

    api<Array<{ id: string; name: string; phoneNumber?: string }>>("/wa/sessions")
      .then((res) => {
        if (Array.isArray(res)) setWaSessions(res);
      })
      .catch(() => {});
  }, []);

  useRealtime((event, data) => {
    if (event === "conversation.updated") {
      const conv = data as Conversation;
      setItems((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx === -1) return [conv, ...prev];
        const next = [...prev];
        next[idx] = conv;
        return next.sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime(),
        );
      });
    }
    if (event === "message.created") {
      const msg = data as Message;
      if (msg.conversationId === activeId) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
        );
      }
    }
  });

  const active = items.find((c) => c.id === activeId) ?? items[0] ?? null;

  // Global Keyboard Shortcuts (J/K navigation, M mode toggle, C claim, R resolve, / search focus)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (isInput) return;

      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        setItems((currentItems) => {
          if (!currentItems.length) return currentItems;
          const currentIndex = currentItems.findIndex((c) => c.id === activeId);
          const nextIndex =
            currentIndex < currentItems.length - 1 ? currentIndex + 1 : 0;
          setActiveId(currentItems[nextIndex].id);
          return currentItems;
        });
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        setItems((currentItems) => {
          if (!currentItems.length) return currentItems;
          const currentIndex = currentItems.findIndex((c) => c.id === activeId);
          const prevIndex =
            currentIndex > 0 ? currentIndex - 1 : currentItems.length - 1;
          setActiveId(currentItems[prevIndex].id);
          return currentItems;
        });
      } else if (e.key === "m" || e.key === "M") {
        if (active) {
          e.preventDefault();
          if (active.mode === "bot") {
            void claimChat();
          } else {
            void enableBot();
          }
        }
      } else if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          "input[placeholder*='Cari']",
        );
        searchInput?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeId, active]);

  async function selectConversation(c: Conversation) {
    setActiveId(c.id);
    setItems((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)),
    );
  }

  async function claimChat() {
    if (!active) return;
    const updated = await api<Conversation>(
      `/conversations/${active.id}/assign`,
      { method: "POST", body: "{}" },
    );
    setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    await loadMessages(active.id);
  }

  async function resolveChat() {
    if (!active) return;
    const updated = await api<Conversation>(
      `/conversations/${active.id}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status: "resolved" }),
      },
    );
    setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function enableBot() {
    if (!active) return;
    const updated = await api<Conversation>(`/conversations/${active.id}/mode`, {
      method: "POST",
      body: JSON.stringify({ mode: "bot" }),
    });
    setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function sendMessage() {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const msg = await api<Message>(`/conversations/${active.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal kirim pesan");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function sendMedia(file: File) {
    if (!active || sending) return;
    setSending(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const msg = await api<Message>(
        `/conversations/${active.id}/media`,
        { method: "POST", body: fd },
      );
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal kirim media");
    } finally {
      setSending(false);
    }
  }

  async function toggleTag(tag: string) {
    if (!active) return;
    const has = (active.tags ?? []).includes(tag);
    const next = has
      ? (active.tags ?? []).filter((t) => t !== tag)
      : [...(active.tags ?? []), tag];
    try {
      const updated = await api<Conversation>(
        `/conversations/${active.id}/tags`,
        { method: "PATCH", body: JSON.stringify({ tags: next }) },
      );
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update label");
    }
  }

  const unreadTotal = useMemo(
    () => items.reduce((n, c) => n + c.unreadCount, 0),
    [items],
  );

  return (
    <div className="flex h-full min-h-0">
      <section className="flex w-full min-w-0 flex-col border-r border-[var(--color-line)] bg-white md:w-[340px] lg:w-[360px]">
        <div className="border-b border-[var(--color-line)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Inbox</h1>
              <span className="hidden rounded bg-[var(--color-paper-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)] border border-[var(--color-line)] md:inline-block" title="Navigasi daftar dengan J/K atau panah">
                J/K
              </span>
            </div>
            <Badge tone="accent">{unreadTotal} baru</Badge>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-faint)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau pesan... (/)"
              className="pl-9"
            />
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs transition",
                  filter === f.id
                    ? "bg-[var(--color-accent)] font-medium text-white"
                    : "bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:bg-[var(--color-paper-3)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* WA Channel Selector Filter */}
          {waSessions.length > 0 ? (
            <div className="mt-2 flex items-center justify-between gap-2 bg-emerald-50/80 p-2 rounded-xl border border-emerald-100 text-xs">
              <span className="font-bold text-emerald-800 flex items-center gap-1 shrink-0">
                📱 Sesi WA:
              </span>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1 outline-none text-[11px] font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">Semua Nomor WA ({waSessions.length})</option>
                {waSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phoneNumber ? `(${s.phoneNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? (
            <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-2" role="listbox" aria-label="Daftar Percakapan">
          {loading ? (
            <div className="p-8 text-center text-sm text-[var(--color-muted)]">
              Memuat percakapan...
            </div>
          ) : null}
          <AnimatePresence initial={false}>
            {items
              .filter((c) => selectedSessionId === "all" || c.waSessionId === selectedSessionId)
              .map((c) => {
                const selected = active?.id === c.id;
                const sessionObj = waSessions.find((s) => s.id === c.waSessionId);
                const sessionLabel = sessionObj ? sessionObj.name : "WA";

                return (
                  <motion.button
                    key={c.id}
                    layout
                    role="option"
                    aria-selected={selected}
                    tabIndex={0}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={() => void selectConversation(c)}
                    className={cn(
                      "mb-1 flex w-full gap-3 rounded-2xl border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                      selected
                        ? "border-[color-mix(in_oklab,var(--color-accent)_35%,white)] bg-[var(--color-accent-soft)]"
                        : "border-transparent hover:border-[var(--color-line)] hover:bg-[var(--color-paper-2)]",
                    )}
                  >
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                      style={{ background: avatarGradient(c.contact?.avatarHue ?? 200) }}
                    >
                      {initials(c.contact?.name ?? "Pelanggan")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {c.contact?.name ?? "Pelanggan"}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-[var(--color-faint)]">
                          {formatRelative(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="truncate text-xs text-[var(--color-muted)]">
                          {c.lastMessagePreview}
                        </p>
                        {c.unreadCount > 0 ? (
                          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <Badge tone={statusTone(c.status)}>
                          {STATUS_LABEL[c.status]}
                        </Badge>
                        {c.channel === "instagram" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-pink-50 px-1.5 py-0.5 text-[10px] font-bold text-pink-700 border border-pink-200">
                            📸 IG
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 truncate max-w-[110px]" title={sessionLabel}>
                            🟢 {sessionLabel}
                          </span>
                        )}
                        {c.mode === "bot" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 truncate max-w-[120px]" title={c.aiAgentName || "Bot AI Utama"}>
                            🤖 {c.aiAgentName || "Bot AI Utama"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
            {!loading && !items.length ? (
              <div className="p-8 text-center text-sm text-[var(--color-muted)]">
                Belum ada percakapan. Hubungkan WhatsApp lalu terima chat.
              </div>
            ) : null}
          </div>
        </section>

        <section className="hidden min-w-0 flex-1 flex-col md:flex">
          {active ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] bg-white px-4 py-3 sm:flex-nowrap">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white shadow-sm"
                    style={{ background: avatarGradient(active.contact?.avatarHue ?? 200) }}
                  >
                    {initials(active.contact?.name ?? "Pelanggan")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="truncate text-sm font-semibold text-[var(--color-ink)] sm:text-base">{active.contact?.name ?? "Pelanggan"}</h2>
                      <Badge tone={statusTone(active.status)} className="shrink-0">
                        {STATUS_LABEL[active.status]}
                      </Badge>
                      {active.mode === "bot" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-300 shadow-sm" title={active.aiAgentName || "Bot AI Utama"}>
                          🤖 {active.aiAgentName || "Bot AI Utama"}
                        </span>
                      ) : null}
                    </div>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {active.contact?.phone ?? ""}
                    {active.assignedName ? ` · ${active.assignedName}` : ""}
                    {(() => {
                      const activeSessionObj = waSessions.find((s) => s.id === active.waSessionId);
                      return activeSessionObj ? ` · 📱 ${activeSessionObj.name}` : "";
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {active.status === "waiting_agent" || active.mode === "bot" ? (
                  <Button size="sm" onClick={() => void claimChat()}>
                    <Hand className="h-3.5 w-3.5" />
                    <span>Ambil chat</span>
                  </Button>
                ) : null}
                {active.mode === "human" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void enableBot()}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>Aktifkan bot</span>
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => void resolveChat()}>
                  Selesai
                </Button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#fbfcf9_0%,#f5f7f4_100%)] px-4 py-5">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onInspectAiSource={(src) => setSelectedAiSource(src)}
                  onEvaluateBotMessage={(msg) => setEvaluatingMessage(msg)}
                />
              ))}
            </div>

            <footer className="border-t border-[var(--color-line)] bg-white p-4">
              {quickReplies.length ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {quickReplies.slice(0, 6).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setDraft(q)}
                      className="max-w-[200px] truncate rounded-full border border-[var(--color-line)] bg-[var(--color-paper-2)] px-2.5 py-1 text-[11px] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                      title={q}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-end gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-2)] p-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void sendMedia(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={sending}
                  className="grid h-10 w-10 place-items-center rounded-xl text-[var(--color-muted)] hover:bg-white"
                  title="Kirim gambar/dokumen"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    } else if (e.key === "Escape") {
                      (e.target as HTMLTextAreaElement).blur();
                    }
                  }}
                  rows={1}
                  placeholder="Tulis balasan... (Enter kirim · Esc lepas fokus)"
                  className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-[var(--color-faint)]"
                />
                <Button
                  size="icon"
                  onClick={() => void sendMessage()}
                  disabled={!draft.trim() || sending}
                  className="shrink-0"
                  title="Kirim pesan (Enter)"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-faint)]">
                <span>Live · text + media via WA · Quick replies</span>
                <span className="hidden gap-2 font-mono sm:flex">
                  <span><kbd className="rounded border bg-white px-1">J</kbd>/<kbd className="rounded border bg-white px-1">K</kbd> pilih</span>
                  <span><kbd className="rounded border bg-white px-1">M</kbd> bot/human</span>
                  <span><kbd className="rounded border bg-white px-1">/</kbd> cari</span>
                </span>
              </div>
            </footer>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-[var(--color-muted)]">
            Pilih percakapan atau hubungkan WhatsApp
          </div>
        )}
      </section>

      <aside className="hidden w-[250px] shrink-0 flex-col overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-paper-2)] p-4 xl:flex 2xl:w-[280px]">
        {active ? (
          <>
            <div className="mb-4 text-center">
              <div
                className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full text-lg font-semibold text-white"
                style={{ background: avatarGradient(active.contact?.avatarHue ?? 200) }}
              >
                {initials(active.contact?.name ?? "Pelanggan")}
              </div>
              <h3 className="font-medium">{active.contact?.name ?? "Pelanggan"}</h3>
              <p className="text-xs text-[var(--color-muted)]">
                {active.contact?.phone ?? ""}
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-[var(--color-line)] bg-white p-3">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-faint)]">
                  Status
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(active.status)}>
                    {STATUS_LABEL[active.status]}
                  </Badge>
                  <Badge tone={active.mode === "bot" ? "bot" : "human"}>
                    {active.mode === "bot" ? "Mode bot" : "Mode human"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-line)] bg-white p-3">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-faint)]">
                  Agent
                </div>
                <div className="flex items-center gap-2 text-[var(--color-text-soft)]">
                  <StatusDot
                    status={active.assignedName ? "online" : "offline"}
                  />
                  {active.assignedName ?? "Belum di-assign"}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-line)] bg-white p-3">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-faint)]">
                  Label
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TAGS.map((tag) => {
                    const on = (active.tags ?? []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => void toggleTag(tag)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium transition",
                          on
                            ? "bg-[var(--color-accent)] text-white"
                            : "bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:bg-[var(--color-paper-3)]",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </aside>

      <AnimatePresence>
        {selectedAiSource ? (
          <AiSourceModal
            source={selectedAiSource}
            onClose={() => setSelectedAiSource(null)}
          />
        ) : null}
        {evaluatingMessage ? (
          <AiEvaluationModal
            message={evaluatingMessage}
            onClose={() => setEvaluatingMessage(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
