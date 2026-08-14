"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Instagram,
  MessageCircle,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, ConfirmDialog, Input, PageHeader } from "@/components/ui";
import type { InstagramCommentRule } from "@cs/shared";

export default function InstagramRulesPage() {
  const [rules, setRules] = useState<InstagramCommentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Form State
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("mau, info, harga, promo");
  const [publicReplyText, setPublicReplyText] = useState("Cek DM kamu ya sis! 😊 Sdh kami kirimkan info lengkapnya.");
  const [privateReplyText, setPrivateReplyText] = useState("Halo Kak! Terima kasih sudah tertarik dengan produk kami. Berikut catalog & promo spesial khusus hari ini:");
  const [targetPostId, setTargetPostId] = useState("");

  async function loadRules() {
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; data: InstagramCommentRule[] }>("/channels/instagram/comment-rules");
      if (res.ok) setRules(res.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !privateReplyText.trim() || saving) return;
    setSaving(true);
    setError("");

    try {
      await api("/channels/instagram/comment-rules", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          keywords: keywords.trim() || "*",
          publicReplyText: publicReplyText.trim() || undefined,
          privateReplyText: privateReplyText.trim(),
          targetPostId: targetPostId.trim() || undefined,
        }),
      });

      setName("");
      setKeywords("mau, info, harga, promo");
      loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat aturan");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRule() {
    if (!deleteTargetId) return;
    setDeletingId(deleteTargetId);
    try {
      await api(`/channels/instagram/comment-rules/${deleteTargetId}`, { method: "DELETE" });
      loadRules();
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
      setDeleteTargetId(null);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Automasi Komentar Instagram (Comment-to-DM)"
        description="Auto-balas komentar penonton Reels/Feed dan kirim pesan DM pribadi secara otomatis."
      />

      {/* Banner Panduan Penjelasan Target Post ID */}
      <div className="rounded-2xl border border-pink-200 bg-pink-50/80 p-4 text-xs text-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-pink-900 text-sm">
          <Instagram className="h-4 w-4 text-pink-600" />
          <span>Panduan Pengisian "Target Post ID":</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
          <li>
            <strong>Rekomendasi (KOSONGKAN)</strong>: Biarkan kolom <code>Target Post ID</code> kosong. Aturan auto-DM ini akan <strong>otomatis merespons komentar di SELURUH Reels &amp; Post Feed IG Anda</strong> secara serentak!
          </li>
          <li>
            <strong>Khusus 1 Reels / Video Spesifik</strong>: Jika hanya ingin pemicu aktif di 1 Reels tertentu (misal: <em>"Ketik PRICELIST di Reels ini"</em>), Anda bisa memasukkan <strong>Shortcode / ID Post</strong> dari URL Instagram:
            <div className="mt-1 font-mono text-[11px] bg-white p-2 rounded-lg border border-pink-200 text-pink-900">
              Contoh URL: https://www.instagram.com/reel/<strong>C3x9aLpS123</strong>/<br />
              👉 Yang dimasukkan sebagai Post ID: <strong>C3x9aLpS123</strong> (atau Media Numeric ID dari Meta API: <code>1784140000000000</code>).
            </div>
          </li>
        </ul>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Form Create Rule */}
        <Card className="p-6 md:col-span-5 border-pink-200 bg-gradient-to-b from-white to-pink-50/20 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-pink-100 pb-3">
            <div className="h-8 w-8 rounded-xl bg-pink-600 text-white grid place-items-center shadow-xs">
              <Instagram className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Tambah Aturan Auto-DM</h3>
              <p className="text-[11px] text-slate-500">Meta Graph API 100% Gratis</p>
            </div>
          </div>

          <form onSubmit={handleCreateRule} className="space-y-3.5 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nama Aturan *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Promo Reels Kopi Senja"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Kata Kunci Komentar (Keywords) *
              </label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="mau, info, harga, promo (atau * untuk semua)"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Pisahkan dengan koma. Gunakan <code>*</code> jika ingin merespon semua komentar.
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Pesan DM Otomatis (Private Reply) *
              </label>
              <textarea
                value={privateReplyText}
                onChange={(e) => setPrivateReplyText(e.target.value)}
                rows={3}
                placeholder="Halo Kak {username}! Ini rincian katalog & promo produk..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-pink-500 font-medium"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Gunakan <code>{`{username}`}</code> untuk mention nama akun pembeli.</span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Target Media / Post ID (Opsional)
              </label>
              <Input
                value={targetPostId}
                onChange={(e) => setTargetPostId(e.target.value)}
                placeholder="Misal: 1784140000000000 (Kosongkan jika untuk semua Reels)"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Biarkan kosong agar aturan ini berlaku untuk <strong>SEMUA Reels &amp; Post Feed</strong> IG.
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Balasan Komentar Publik (Opsional)
              </label>
              <Input
                value={publicReplyText}
                onChange={(e) => setPublicReplyText(e.target.value)}
                placeholder="Halo Kak @{username}, cek DM kamu ya! 😊"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Dibalas publik di bawah postingan Reels.</span>
            </div>

            {error ? <p className="text-xs text-rose-600 font-semibold">{error}</p> : null}

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold"
            >
              <Plus className="h-4 w-4 mr-1" />
              {saving ? "Menyimpan..." : "Aktifkan Aturan DM"}
            </Button>
          </form>
        </Card>

        {/* List Rules */}
        <Card className="p-6 md:col-span-7 space-y-4 border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Zap className="h-4 w-4 text-pink-600" />
              Daftar Aturan Aktif ({rules.length})
            </h3>
            <Badge tone="accent">Auto DM Active</Badge>
          </div>

          {!loading && !rules.length ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
              Belum ada aturan automasi komentar. Buat aturan pertama Anda di panel samping!
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-pink-300 transition-all space-y-2 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h4 className="font-bold text-sm text-slate-900">{r.name}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(r.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="font-semibold text-pink-700 bg-pink-100/80 px-2 py-0.5 rounded-md">
                      🔑 Keywords: {r.keywords}
                    </span>
                    {r.targetPostId ? (
                      <span className="font-semibold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-md">
                        📌 Target Post ID: {r.targetPostId}
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        🌐 Semua Reels &amp; Post
                      </span>
                    )}
                    {r.publicReplyText ? (
                      <span className="font-semibold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                        💬 Public Reply Active
                      </span>
                    ) : null}
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Pesan Auto DM:</span>
                    "{r.privateReplyText}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteRule}
        loading={!!deletingId}
        title="Hapus Aturan Automasi Komentar Instagram?"
        description="Aturan automasi balas komentar dan auto-DM ini akan dihapus secara permanen dari sistem."
        confirmText="Ya, Hapus Aturan"
      />
    </div>
  );
}
