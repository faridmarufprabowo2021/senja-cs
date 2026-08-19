"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Zap,
  UserCheck,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  MessageSquare,
  Flame,
  Bot,
  Send,
  RefreshCw,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { api, getSession } from "@/lib/api";

type SlaMetrics = {
  totalMessages: number;
  customerMessageCount: number;
  agentMessageCount: number;
  botMessageCount: number;
  medianResponseTimeSec: number;
  medianResponseTimeFormatted: string;
  slaStatus: "green" | "yellow" | "red";
  slaLabel: string;
};

type AnalyticsInsight = {
  intentScore: number;
  funnelStage: string;
  personaTags: string[];
  desires: string[];
  unansweredQuestions: string[];
  objections: string[];
  smartReplyDraft: string;
};

type ChatInsightResult = {
  slaMetrics: SlaMetrics;
  analyticsInsight: AnalyticsInsight;
};

interface ChatInsightSidebarProps {
  conversationId: string;
  onApplyDraft?: (draftText: string) => void;
}

export function ChatInsightSidebar({
  conversationId,
  onApplyDraft,
}: ChatInsightSidebarProps) {
  const [data, setData] = useState<ChatInsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userRole, setUserRole] = useState<string>("agent");

  // Accordion Section States
  const [openSla, setOpenSla] = useState(true);
  const [openPersona, setOpenPersona] = useState(true);
  const [openUnanswered, setOpenUnanswered] = useState(true);
  const [openSmartReply, setOpenSmartReply] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (session) {
      const tenant =
        session.tenants.find((t) => t.id === session.tenantId) ??
        session.tenants[0];
      if (tenant) {
        setUserRole(tenant.role || "agent");
      }
    }
  }, []);

  const loadInsights = async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await api<ChatInsightResult>(
        `/conversations/${conversationId}/insights`,
      );
      setData(res);
    } catch (err) {
      console.warn("Gagal memuat wawasan percakapan", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInsights();
  }, [conversationId]);

  const handleCopy = (text: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOwnerOrManager = userRole === "owner" || userRole === "admin" || userRole === "manager";

  if (!conversationId) return null;

  return (
    <div className="w-80 border-l border-[var(--color-line)] bg-slate-50/50 flex flex-col h-full overflow-y-auto p-3.5 space-y-3.5 shrink-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          <span>Wawasan Chat 360°</span>
        </div>
        <button
          onClick={() => void loadInsights()}
          disabled={loading}
          className="p-1 hover:bg-slate-200/60 rounded-lg transition text-slate-500 hover:text-slate-800"
          title="Refresh Wawasan"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="py-8 text-center text-xs text-slate-500 font-medium animate-pulse space-y-2">
          <Bot className="h-6 w-6 mx-auto text-slate-400" />
          <p>Menganalisis SLA &amp; profil pelanggan...</p>
        </div>
      ) : data ? (
        <>
          {/* 1. SLA & SOP Compliance Card (Owner & Manager Only) */}
          {isOwnerOrManager && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2.5">
              <button
                type="button"
                onClick={() => setOpenSla(!openSla)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-900"
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>SOP Response Time SLA</span>
                </div>
                {openSla ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
              </button>

              {openSla && (
                <div className="space-y-2 text-xs pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[11px]">Status SLA CS:</span>
                    <Badge
                      tone={
                        data.slaMetrics.slaStatus === "green"
                          ? "success"
                          : data.slaMetrics.slaStatus === "yellow"
                          ? "warn"
                          : "danger"
                      }
                      className="text-[10px] font-semibold"
                    >
                      {data.slaMetrics.slaLabel}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                      <span className="block text-[10px] text-slate-400 font-medium">Median Respon CS</span>
                      <span className="text-xs font-black text-slate-800">
                        {data.slaMetrics.medianResponseTimeFormatted}
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2 border border-slate-100">
                      <span className="block text-[10px] text-slate-400 font-medium">Pesan Admin / AI</span>
                      <span className="text-xs font-black text-slate-800">
                        {data.slaMetrics.agentMessageCount} / {data.slaMetrics.botMessageCount}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Buyer Profiling 360° Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2.5">
            <button
              type="button"
              onClick={() => setOpenPersona(!openPersona)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-900"
            >
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-amber-500" />
                <span>Profil &amp; Niat Beli (Intent)</span>
              </div>
              {openPersona ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
            </button>

            {openPersona && (
              <div className="space-y-2.5 text-xs pt-1 border-t border-slate-100">
                {/* Intent Progress Bar */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-700">Buying Intent:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {data.analyticsInsight.intentScore}% ({data.analyticsInsight.funnelStage})
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(10, data.analyticsInsight.intentScore))}%` }}
                    />
                  </div>
                </div>

                {/* Persona Tags */}
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Karakter Buyer:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {data.analyticsInsight.personaTags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 text-[10px] font-semibold"
                      >
                        🏷️ {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Desires */}
                {data.analyticsInsight.desires.length > 0 && (
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Kebutuhan / Keinginan:
                    </span>
                    <ul className="space-y-1">
                      {data.analyticsInsight.desires.map((d, i) => (
                        <li key={i} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Unanswered Questions & Objections Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2.5">
            <button
              type="button"
              onClick={() => setOpenUnanswered(!openUnanswered)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-900"
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <span>Pertanyaan &amp; Keberatan</span>
              </div>
              {openUnanswered ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
            </button>

            {openUnanswered && (
              <div className="space-y-2.5 text-xs pt-1 border-t border-slate-100">
                {/* Unanswered Questions */}
                <div>
                  <span className="block text-[10px] text-rose-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>⚠️ Belum Dijawab CS:</span>
                  </span>
                  {data.analyticsInsight.unansweredQuestions.length > 0 ? (
                    <ul className="space-y-1">
                      {data.analyticsInsight.unansweredQuestions.map((q, i) => (
                        <li key={i} className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px] font-medium text-rose-900 leading-relaxed">
                          &quot;{q}&quot;
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      ✅ Semua pertanyaan terdeteksi sudah dijawab!
                    </p>
                  )}
                </div>

                {/* Objections */}
                {data.analyticsInsight.objections.length > 0 && (
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Keraguan / Keberatan:
                    </span>
                    <ul className="space-y-1">
                      {data.analyticsInsight.objections.map((obj, i) => (
                        <li key={i} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                          <span className="text-amber-500">💔</span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Smart Reply Assistant Card */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 shadow-2xs space-y-2.5">
            <button
              type="button"
              onClick={() => setOpenSmartReply(!openSmartReply)}
              className="w-full flex items-center justify-between text-xs font-bold text-blue-950"
            >
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-blue-600 fill-current" />
                <span>Rekomendasi Balasan AI</span>
              </div>
              {openSmartReply ? <ChevronUp className="h-3.5 w-3.5 text-blue-400" /> : <ChevronDown className="h-3.5 w-3.5 text-blue-400" />}
            </button>

            {openSmartReply && (
              <div className="space-y-2 text-xs pt-1 border-t border-blue-100">
                <div className="rounded-xl bg-white border border-blue-200 p-2.5 text-[11px] font-sans text-slate-800 leading-relaxed shadow-2xs">
                  {data.analyticsInsight.smartReplyDraft}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCopy(data.analyticsInsight.smartReplyDraft)}
                    className="h-7 text-[10px] font-bold gap-1 bg-white hover:bg-slate-100"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? "Tersalin!" : "Salin Teks"}</span>
                  </Button>

                  {onApplyDraft && (
                    <Button
                      size="sm"
                      onClick={() => onApplyDraft(data.analyticsInsight.smartReplyDraft)}
                      className="h-7 text-[10px] font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="h-3 w-3" />
                      <span>🚀 Isi ke Chat</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="py-4 text-center text-xs text-slate-400">Pilih percakapan untuk melihat analisis.</p>
      )}
    </div>
  );
}
