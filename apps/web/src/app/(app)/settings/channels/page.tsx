"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Facebook,
  HelpCircle,
  Image as ImageIcon,
  Instagram,
  Key,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import type { InstagramChannelConfig, InstagramMediaItem, InstagramProfileData } from "@cs/shared";

export default function ChannelsSettingsPage() {
  const [igAccessToken, setIgAccessToken] = useState("");
  const [igPageId, setIgPageId] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [config, setConfig] = useState<InstagramChannelConfig | null>(null);
  const [profile, setProfile] = useState<InstagramProfileData | null>(null);
  const [mediaList, setMediaList] = useState<InstagramMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ ok: boolean; data: InstagramChannelConfig }>("/channels/instagram/config")
      .then((res) => {
        if (res.data) {
          setConfig(res.data);
          setIgPageId(res.data.pageId || "");
          setIgUserId(res.data.userId || "");

          if (res.data.connected) {
            // Fetch extracted Instagram profile and media list
            api<{ ok: boolean; data: InstagramProfileData }>("/channels/instagram/profile")
              .then((pRes) => { if (pRes.data) setProfile(pRes.data); })
              .catch(() => {});

            api<{ ok: boolean; data: InstagramMediaItem[] }>("/channels/instagram/media")
              .then((mRes) => { if (mRes.data) setMediaList(mRes.data); })
              .catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveInstagram() {
    setSaving(true);
    setMessage("");
    try {
      const res = await api<{ ok: boolean; data: InstagramChannelConfig }>(
        "/channels/instagram/config",
        {
          method: "POST",
          body: JSON.stringify({
            igAccessToken: igAccessToken.trim() || undefined,
            igPageId: igPageId.trim() || undefined,
            igUserId: igUserId.trim() || undefined,
            igConnected: true,
          }),
        },
      );
      setConfig(res.data);
      setMessage("✅ Channel Instagram DM berhasil diaktifkan & terhubung!");
      setIgAccessToken("");
    } catch (err) {
      setMessage(err instanceof Error ? `❌ ${err.message}` : "❌ Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Pengaturan Channel Messaging (Multi-Platform)"
        description="Hubungkan WhatsApp dan Instagram Direct Message (DM) secara terpadu."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* WhatsApp Card */}
        <Card className="p-5 border-emerald-200 bg-emerald-50/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white grid place-items-center font-bold shadow-sm">
                WA
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">WhatsApp (Baileys / OpenWA)</h3>
                <p className="text-xs text-slate-500">Nomor WhatsApp Utama</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> Terhubung
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            WhatsApp telah aktif sebagai channel utama. Pelanggan yang mengirim pesan ke nomor WA ini akan ditangani oleh AI RAG &amp; Flow Builder secara otomatis.
          </p>

          <a
            href="/channels"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
          >
            Kelola QR Code &amp; Status WA →
          </a>
        </Card>

        {/* Instagram DM Card */}
        <Card className="p-5 border-pink-200 bg-pink-50/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white grid place-items-center shadow-sm">
                <Instagram className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">Instagram DM</h3>
                <p className="text-xs text-slate-500">Meta Graph API (100% Gratis)</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                config?.connected
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {config?.connected ? "✓ Terhubung" : "Belum Aktif"}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* 1-Click Meta OAuth Button */}
            <div className="p-3.5 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 space-y-2">
              <span className="font-extrabold text-slate-800 block text-xs">🚀 Rekomendasi: Opsi 1-Click Login</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Klien/Pengguna tidak perlu mendaftar Meta Developer. Cukup klik tombol di bawah ini untuk menghubungkan akun Instagram Bisnis secara instant.
              </p>
              <Button
                size="sm"
                type="button"
                onClick={async () => {
                  try {
                    const res = await api<{ ok: boolean; oauthUrl: string }>("/channels/instagram/oauth/url");
                    if (res.oauthUrl) window.location.href = res.oauthUrl;
                  } catch {
                    alert("Gagal memuat URL Meta OAuth");
                  }
                }}
                className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-extrabold shadow-sm flex items-center justify-center gap-2 py-2"
              >
                <Facebook className="h-4 w-4 fill-white" />
                <span>Hubungkan dengan Facebook / Instagram (1-Click)</span>
              </Button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-slate-400">Atau Isi Manual (Pengembang)</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Meta Page Access Token *
              </label>
              <Input
                type="password"
                value={igAccessToken}
                onChange={(e) => setIgAccessToken(e.target.value)}
                placeholder={
                  config?.accessTokenMasked
                    ? `Sudah tersimpan (${config.accessTokenMasked}) — isi untuk ganti`
                    : "Paste Page Access Token dari Meta Developer App..."
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Facebook Page ID (Opsional)
                </label>
                <Input
                  value={igPageId}
                  onChange={(e) => setIgPageId(e.target.value)}
                  placeholder="Contoh: 109283746..."
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Instagram User ID (Opsional)
                </label>
                <Input
                  value={igUserId}
                  onChange={(e) => setIgUserId(e.target.value)}
                  placeholder="Contoh: 178414000..."
                />
              </div>
            </div>

            {message ? (
              <p className="text-xs font-medium text-slate-700">{message}</p>
            ) : null}

            <Button
              size="sm"
              onClick={handleSaveInstagram}
              disabled={saving}
              className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold"
            >
              {saving ? "Menyimpan..." : "✓ Simpan & Aktifkan Status Instagram"}
            </Button>
          </div>
        </Card>
      </div>

      {/* Extracted Instagram Profile & Recent Posts Widget */}
      {config?.connected ? (
        <Card className="p-6 border-purple-200 bg-gradient-to-r from-purple-50/50 via-pink-50/30 to-white space-y-6">
          <div className="flex items-center justify-between border-b border-purple-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5 shadow-md">
                <div className="h-full w-full rounded-[14px] bg-white p-0.5 overflow-hidden grid place-items-center">
                  {profile?.profilePictureUrl ? (
                    <img src={profile.profilePictureUrl} alt="IG Avatar" className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    <Instagram className="h-6 w-6 text-purple-600" />
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">
                    @{profile?.username || "instagram_bisnis"}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    ✓ Data Akun Terhubung (Meta API)
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {profile?.name || "Akun Instagram Bisnis"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
              <div className="text-center px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200 shadow-2xs">
                <span className="block text-slate-400 text-[10px] uppercase">Followers</span>
                <span className="font-bold text-sm text-purple-700">{profile?.followersCount?.toLocaleString("id-ID") ?? "-"}</span>
              </div>
              <div className="text-center px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200 shadow-2xs">
                <span className="block text-slate-400 text-[10px] uppercase">Postingan</span>
                <span className="font-bold text-sm text-pink-700">{profile?.mediaCount?.toLocaleString("id-ID") ?? "-"}</span>
              </div>
            </div>
          </div>

          {/* Media Feed Preview */}
          {mediaList.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-pink-600" />
                  Daftar Postingan &amp; Reels Terbaru (Ekstraksi Otomatis)
                </h4>
                <a
                  href="/settings/instagram-rules"
                  className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1"
                >
                  ⚡ Kelola Aturan Comment-to-DM Sales Funnel →
                </a>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {mediaList.slice(0, 6).map((item) => (
                  <a
                    key={item.id}
                    href={item.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:shadow-md transition"
                  >
                    {item.mediaUrl ? (
                      <img src={item.mediaUrl} alt="IG Feed" className="h-full w-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="h-full w-full grid place-items-center bg-slate-200 text-slate-400">
                        <Instagram className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition p-2 flex flex-col justify-end text-[10px] text-white">
                      <p className="line-clamp-2 font-medium">{item.caption || "Postingan Instagram"}</p>
                      <div className="flex items-center gap-2 mt-1 font-bold text-pink-200">
                        <span>💬 {item.commentsCount ?? 0}</span>
                        <span>❤️ {item.likeCount ?? 0}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              📸 Data feed postingan Instagram akan ditampilkan otomatis setelah terhubung ke Meta Graph API.
            </p>
          )}
        </Card>
      ) : null}

      {/* Comprehensive Integration Step-by-Step Guide */}
      <Card className="p-6 border-slate-200 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 grid place-items-center font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">
              📖 Panduan Langkah demi Langkah Hubungkan Instagram ke Senja CS
            </h3>
            <p className="text-xs text-slate-500">
              Integrasi resmi Meta Graph API (100% Gratis, 0 syarat follower, tanpa biaya per-pesan).
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 text-xs text-slate-600">
          {/* Step 1 */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <span className="h-6 w-6 rounded-lg bg-pink-600 text-white text-xs grid place-items-center">1</span>
              Ubah ke Akun Bisnis / Kreator
            </div>
            <p className="leading-relaxed">
              Buka aplikasi Instagram di HP ➔ <strong>Pengaturan &amp; Privasi</strong> ➔ <strong>Jenis &amp; Alat Akun</strong> ➔ Beralih ke Akun Profesional (Bisnis atau Kreator). Ini 100% Gratis dan tidak ada syarat jumlah follower minimum.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <span className="h-6 w-6 rounded-lg bg-pink-600 text-white text-xs grid place-items-center">2</span>
              Hubungkan ke Facebook Page
            </div>
            <p className="leading-relaxed">
              Di halaman profil Instagram ➔ Edit Profil ➔ Hubungkan dengan Halaman Facebook (Facebook Page) bisnis Anda. Langkah ini diperlukan agar Meta Graph API bisa membaca pesan DM &amp; komentar.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <span className="h-6 w-6 rounded-lg bg-pink-600 text-white text-xs grid place-items-center">3</span>
              Buat App di Meta Developers
            </div>
            <p className="leading-relaxed">
              Buka <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-pink-600 font-bold underline inline-flex items-center gap-0.5">developers.facebook.com <ExternalLink className="h-3 w-3" /></a> ➔ Klik <strong>My Apps</strong> ➔ <strong>Create App</strong> (pilih tipe <em>Business</em>).
            </p>
            <p className="leading-relaxed">
              Tambahkan produk <strong>Instagram Graph API</strong> &amp; <strong>Webhooks</strong>.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <span className="h-6 w-6 rounded-lg bg-pink-600 text-white text-xs grid place-items-center">4</span>
              Ambil Page Access Token
            </div>
            <p className="leading-relaxed">
              Di Meta Dashboard ➔ Tools ➔ <strong>Graph API Explorer</strong>:
            </p>
            <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-slate-700">
              <li>Pilih Facebook Page Anda</li>
              <li>Izin yang dicentang: <code>instagram_basic</code>, <code>instagram_manage_messages</code>, <code>instagram_manage_comments</code>, <code>pages_messaging</code></li>
              <li>Generate Token ➔ Copy token lalu paste di kolom atas.</li>
            </ul>
          </div>
        </div>

        {/* Webhook Settings Box */}
        <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 space-y-3">
          <h4 className="font-bold text-sm text-purple-900 flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-600" />
            Pengaturan Callback Webhook di Meta Developers:
          </h4>
          <div className="grid gap-2 sm:grid-cols-3 text-xs font-mono text-slate-800">
            <div className="p-3 bg-white rounded-xl border border-purple-100">
              <span className="text-[10px] font-bold text-purple-700 block uppercase mb-1">Callback URL:</span>
              <code>https://domain-anda.com/api/v1/channels/instagram/webhook</code>
            </div>
            <div className="p-3 bg-white rounded-xl border border-purple-100">
              <span className="text-[10px] font-bold text-purple-700 block uppercase mb-1">Verify Token:</span>
              <code>senja_cs_meta_verify_token</code>
            </div>
            <div className="p-3 bg-white rounded-xl border border-purple-100">
              <span className="text-[10px] font-bold text-purple-700 block uppercase mb-1">Subscribed Fields:</span>
              <code>messages</code>, <code>messaging_postbacks</code>, <code>comments</code>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
