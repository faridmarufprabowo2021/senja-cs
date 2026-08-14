"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Zap,
  Image,
  Bot,
  GitBranch,
  CreditCard,
  UserCheck,
  Globe,
  SlidersHorizontal,
  FormInput,
} from "lucide-react";

export const TriggerNode = memo(({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border-2 border-emerald-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-emerald-700 text-[11px] uppercase tracking-wider mb-1.5 bg-emerald-50 px-2 py-1 rounded-lg w-fit">
        <Zap className="h-3.5 w-3.5" /> Trigger Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "Pesan WA Masuk"}</div>
      <div className="text-xs text-[var(--color-muted)] mt-1">
        {data?.triggerType === "keyword"
          ? `Kata kunci: ${data?.keywords || "semua"}`
          : "Semua Pesan WA Masuk"}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
    </div>
  );
});
TriggerNode.displayName = "TriggerNode";

export const MediaNode = memo(({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border-2 border-sky-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-sky-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-sky-700 text-[11px] uppercase tracking-wider mb-1.5 bg-sky-50 px-2 py-1 rounded-lg w-fit">
        <Image className="h-3.5 w-3.5" /> Media Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "Kirim Foto / Brosur"}</div>
      <div className="text-xs text-[var(--color-muted)] mt-1 truncate max-w-[180px]">
        {data?.caption || "Foto / PDF Katalog"}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-sky-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
    </div>
  );
});
MediaNode.displayName = "MediaNode";

export const AINode = memo(({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border-2 border-purple-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-purple-700 text-[11px] uppercase tracking-wider mb-1.5 bg-purple-50 px-2 py-1 rounded-lg w-fit">
        <Bot className="h-3.5 w-3.5" /> AI RAG Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "AI & Katalog Auto-Photo"}</div>
      <div className="text-xs text-[var(--color-muted)] mt-1">
        LLM RAG + Auto Attach Product Photo
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
    </div>
  );
});
AINode.displayName = "AINode";

export const ConditionNode = memo(({ data }: any) => {
  return (
    <div className="min-w-[220px] rounded-2xl border-2 border-amber-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-amber-700 text-[11px] uppercase tracking-wider mb-1.5 bg-amber-50 px-2 py-1 rounded-lg w-fit">
        <GitBranch className="h-3.5 w-3.5" /> Condition Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "Kondisi / Percabangan"}</div>
      <div className="flex justify-between items-center text-xs mt-3 pt-2 border-t border-[var(--color-line)]">
        <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Ya / Match</span>
        <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">Tidak / Else</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="!bg-emerald-500 !w-3.5 !h-3.5 !left-[30%] !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="!bg-rose-500 !w-3.5 !h-3.5 !left-[70%] !border-2 !border-white"
      />
    </div>
  );
});
ConditionNode.displayName = "ConditionNode";

export const ActionNode = memo(({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border-2 border-teal-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-teal-700 text-[11px] uppercase tracking-wider mb-1.5 bg-teal-50 px-2 py-1 rounded-lg w-fit">
        <CreditCard className="h-3.5 w-3.5" /> Action Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "Buat Invoice / QRIS"}</div>
      <div className="text-xs text-[var(--color-muted)] mt-1">
        {data?.actionType || "B1 Invoice / B2 QRIS / B3 Nota"}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-teal-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
    </div>
  );
});
ActionNode.displayName = "ActionNode";

export const HandoverNode = memo(({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border-2 border-rose-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-rose-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-rose-700 text-[11px] uppercase tracking-wider mb-1.5 bg-rose-50 px-2 py-1 rounded-lg w-fit">
        <UserCheck className="h-3.5 w-3.5" /> Handover Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "Alihkan ke CS Manusia"}</div>
      <div className="text-xs text-rose-600 mt-1 font-medium">
        Bot Off + Lonceng Alert 🔔
      </div>
    </div>
  );
});
HandoverNode.displayName = "HandoverNode";

export const WebhookNode = memo(({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border-2 border-indigo-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-indigo-700 text-[11px] uppercase tracking-wider mb-1.5 bg-indigo-50 px-2 py-1 rounded-lg w-fit">
        <Globe className="h-3.5 w-3.5" /> Webhook Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "Kirim ke Google Sheets"}</div>
      <div className="text-xs text-[var(--color-muted)] mt-1 truncate max-w-[180px]">
        {data?.webhookUrl || "HTTP POST External"}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
    </div>
  );
});
WebhookNode.displayName = "WebhookNode";

export const ButtonNode = memo(({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border-2 border-cyan-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-cyan-700 text-[11px] uppercase tracking-wider mb-1.5 bg-cyan-50 px-2 py-1 rounded-lg w-fit">
        <SlidersHorizontal className="h-3.5 w-3.5" /> WA Buttons Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "Pesan Tombol Pilihan"}</div>
      <div className="text-xs text-cyan-700 font-semibold mt-2 space-y-1">
        <div className="bg-cyan-50/80 px-2 py-0.5 rounded border border-cyan-200">🔘 {data?.btn1 || "Pilihan 1"}</div>
        {data?.btn2 && <div className="bg-cyan-50/80 px-2 py-0.5 rounded border border-cyan-200">🔘 {data?.btn2}</div>}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
    </div>
  );
});
ButtonNode.displayName = "ButtonNode";

export const InputNode = memo(({ data }: any) => {
  return (
    <div className="min-w-[210px] rounded-2xl border-2 border-orange-500 bg-white p-3.5 text-[var(--color-ink)] shadow-md hover:shadow-lg transition-all">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
      <div className="flex items-center gap-1.5 font-bold text-orange-700 text-[11px] uppercase tracking-wider mb-1.5 bg-orange-50 px-2 py-1 rounded-lg w-fit">
        <FormInput className="h-3.5 w-3.5" /> Capture Input Node
      </div>
      <div className="text-sm font-bold text-[var(--color-ink)]">{data?.label || "Minta Input Pembeli"}</div>
      <div className="text-xs text-orange-700 font-medium mt-1">
        Variabel: <code className="bg-orange-100 px-1 py-0.5 rounded font-mono text-[11px]">{`{{${data?.varName || "user_input"}}}`}</code>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-500 !w-3.5 !h-3.5 !border-2 !border-white"
      />
    </div>
  );
});
InputNode.displayName = "InputNode";
