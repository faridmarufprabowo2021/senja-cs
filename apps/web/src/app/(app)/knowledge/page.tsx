"use client";

import { motion } from "framer-motion";
import { Eye, FileText, Image as ImageIcon, Plus, RefreshCw, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AiAgent, KnowledgeDocument } from "@cs/shared";
import { Badge, Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { isManager } from "@/lib/roles";
import { formatRelative } from "@/lib/utils";

function statusTone(s: KnowledgeDocument["status"]) {
  if (s === "ready") return "success" as const;
  if (s === "processing") return "warn" as const;
  return "danger" as const;
}

function statusLabel(s: KnowledgeDocument["status"]) {
  if (s === "ready") return "Siap";
  if (s === "processing") return "Memproses";
  return "Gagal";
}

type KnowledgeDocumentDetail = KnowledgeDocument & {
  content?: string;
  chunks?: { id: string; chunkIndex: number; content: string }[];
  imageUrl?: string;
  imageName?: string;
  imageCaption?: string;
};

export default function KnowledgePage() {
  const manager = isManager();
  const [docs, setDocs] = useState<KnowledgeDocumentDetail[]>([]);
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [faqTitle, setFaqTitle] = useState("FAQ tambahan");
  const [faqText, setFaqText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const imgUploadRef = useRef<HTMLInputElement>(null);

  // View Document Content State
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocumentDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Modal Image Upload State
  const [showImgModal, setShowImgModal] = useState(false);
  const [imgName, setImgName] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [imgCaption, setImgCaption] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const refresh = useCallback(async () => {
    if (!manager) return;
    try {
      const [list, agentsList] = await Promise.all([
        api<KnowledgeDocumentDetail[]>("/knowledge/documents"),
        api<AiAgent[]>("/ai-agents").catch(() => []),
      ]);
      setDocs(list);
      setAgents(agentsList);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat knowledge");
    }
  }, [manager]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!manager) {
    return (
      <div className="p-8">
        <PageHeader
          title="Knowledge"
          description="Hanya owner/admin yang bisa mengelola knowledge base."
        />
        <p className="text-sm text-[var(--color-muted)]">
          Minta admin untuk upload FAQ. Anda tetap bisa balas chat di Inbox.
        </p>
      </div>
    );
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    setError("");
    try {
      for (const file of list) {
        const text = await file.text();
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "txt";
        await api("/knowledge/documents", {
          method: "POST",
          body: JSON.stringify({
            title: file.name,
            content: text,
            sourceType: ["md", "txt", "pdf", "faq"].includes(ext) ? ext : "txt",
          }),
        });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setBusy(false);
    }
  }

  async function uploadMediaFiles(files: FileList) {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await api<{ ok: boolean; document?: { fileUrl?: string; title?: string } }>(
          "/knowledge/upload-media",
          {
            method: "POST",
            body: formData,
          },
        );

        if (res.document?.fileUrl && file.type.startsWith("image/")) {
          setImgUrl(res.document.fileUrl);
          setImgName(file.name.replace(/\.[^/.]+$/, ""));
          setShowImgModal(true);
        }
      }
      setToast("Berhasil mengunggah file media ke Knowledge Base!");
      setTimeout(() => setToast(""), 4000);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal unggah media");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddImageDoc() {
    if (!imgName.trim() || !imgUrl.trim()) {
      setError("Nama gambar dan URL/File gambar wajib diisi");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/knowledge/image", {
        method: "POST",
        body: JSON.stringify({
          imageName: imgName.trim(),
          imageUrl: imgUrl.trim(),
          imageCaption: imgCaption.trim(),
          aiAgentId: selectedAgentId || undefined,
        }),
      });
      setShowImgModal(false);
      setImgName("");
      setImgUrl("");
      setImgCaption("");
      setToast("Foto berhasil ditambahkan ke Knowledge Base AI Agent!");
      setTimeout(() => setToast(""), 4000);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan foto ke Knowledge Base");
    } finally {
      setBusy(false);
    }
  }

  async function addFaq() {
    if (!faqText.trim()) return;
    setBusy(true);
    try {
      await api("/knowledge/documents", {
        method: "POST",
        body: JSON.stringify({
          title: faqTitle || "FAQ",
          content: faqText,
          sourceType: "faq",
        }),
      });
      setFaqText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan FAQ");
    } finally {
      setBusy(false);
    }
  }

  async function reindex(id: string) {
    setBusy(true);
    try {
      await api(`/knowledge/documents/${id}/reindex`, { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reindex gagal");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await api(`/knowledge/documents/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (selectedDoc?.id === id) setSelectedDoc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hapus gagal");
    } finally {
      setBusy(false);
    }
  }

  async function viewDocDetail(id: string) {
    setViewLoading(true);
    setError("");
    try {
      const detail = await api<KnowledgeDocumentDetail>(`/knowledge/documents/${id}`);
      setSelectedDoc(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat isi dokumen");
    } finally {
      setViewLoading(false);
    }
  }

  const [toast, setToast] = useState("");

  async function extractCatalog(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ ok: boolean; message: string }>(`/knowledge/documents/${id}/extract-catalog`, {
        method: "POST",
      });
      setToast(res.message);
      setTimeout(() => setToast(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengestrak katalog");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Knowledge Base & Media Asset"
        description="Sumber jawaban & foto produk/brosur RAG — upload FAQ, foto katalog, denah, dan PDF."
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowImgModal(true)}
              variant="secondary"
              className="border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 font-bold"
            >
              <ImageIcon className="h-4 w-4 mr-1 text-purple-600" />
              + Unggah Foto / Gambar
            </Button>
            <Button
              onClick={() => mediaFileRef.current?.click()}
              disabled={busy}
              variant="secondary"
              className="border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold"
            >
              <Upload className="h-4 w-4" />
              Upload PDF Brosur
            </Button>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <Upload className="h-4 w-4" />
              Upload Teks FAQ
            </Button>
          </div>
        }
      />

      {/* Banner Petunjuk Foto Knowledge Base */}
      <div className="mb-6 rounded-2xl border border-purple-200 bg-purple-50/80 p-4 text-xs text-purple-950 shadow-2xs flex items-start gap-3">
        <span className="text-xl">🖼️</span>
        <div>
          <h4 className="font-bold text-purple-950 text-sm mb-0.5">Fitur Foto / Gambar di Knowledge Base</h4>
          <p className="leading-relaxed">
            Anda dapat mengunggah foto brosur, denah lokasi, atau foto produk ke dalam Knowledge Base. Ketika pelanggan chat bertanya <em>"ada foto brosur hemat?"</em> atau <em>"minta foto denah lokasi"</em>, AI Agent akan secara otomatis mencocokkan nama gambar dan <strong>mengirimkan fisik foto tersebut langsung ke WhatsApp pelanggan</strong>!
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.csv,.json"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <input
        ref={mediaFileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadMediaFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {toast ? (
        <p className="mb-4 rounded-xl bg-[var(--color-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-accent)]">
          {toast}
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-sm text-[var(--color-sunset)]">
          {error}
        </p>
      ) : null}

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
        className={`mb-6 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragOver
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
            : "border-[var(--color-line)] bg-white hover:border-[var(--color-muted)]"
        }`}
      >
        <Upload className="mx-auto mb-2 h-8 w-8 text-[var(--color-muted)]" />
        <p className="text-sm font-medium">
          Drag &amp; drop file .txt / .md / foto di sini, atau klik tombol Upload
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Dokumen &amp; gambar akan otomatis dipotong (*chunking*), di-embed RAG, dan diekstrak ke Katalog Produk.
        </p>
      </motion.div>

      <Card className="mb-8 p-5">
        <h2 className="mb-3 font-semibold text-sm">Tambah FAQ Cepat</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Judul / Kategori (cth: Jam Buka, Pembayaran)"
            value={faqTitle}
            onChange={(e) => setFaqTitle(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
          <Textarea
            rows={3}
            placeholder="Ketik Q&amp;A atau informasi produk/layanan... (cth: Q: Berapa harga scaling? A: Rp 250.000)"
            value={faqText}
            onChange={(e) => setFaqText(e.target.value)}
          />
          <Button disabled={busy || !faqText.trim()} onClick={() => void addFaq()}>
            Simpan ke Knowledge
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-[var(--color-ink)]">Daftar Dokumen &amp; Asset Foto Knowledge ({docs.length})</h2>
        {!docs.length ? (
          <Card className="p-8 text-center text-sm text-[var(--color-muted)]">
            Belum ada dokumen / foto. Unggah FAQ atau foto agar bot bisa menjawab.
          </Card>
        ) : (
          docs.map((doc) => {
            const isImageDoc = doc.sourceType === "image" || Boolean(doc.imageUrl);
            return (
              <Card
                key={doc.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  {isImageDoc && doc.imageUrl ? (
                    <img
                      src={doc.imageUrl}
                      alt={doc.imageName || doc.title}
                      className="h-12 w-12 rounded-xl object-cover border border-[var(--color-line)] shrink-0"
                    />
                  ) : (
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                      <FileText className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-[var(--color-ink)] flex items-center gap-1.5">
                      {doc.title}
                      {isImageDoc ? <Badge tone="accent">🖼️ Foto Media</Badge> : null}
                    </div>
                    {doc.imageCaption ? (
                      <p className="text-xs text-[var(--color-muted)] italic mt-0.5 line-clamp-1">
                        "{doc.imageCaption}"
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                      <Badge tone={statusTone(doc.status)}>
                        {statusLabel(doc.status)}
                      </Badge>
                      <span className="uppercase">{doc.sourceType}</span>
                      <span>·</span>
                      <span>{doc.chunkCount ?? 0} chunks</span>
                      <span>·</span>
                      <span>{formatRelative(doc.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(doc.sourceType === "pdf" || isImageDoc || Boolean((doc as any).fileUrl)) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold"
                      onClick={() => {
                        const url = doc.imageUrl || (doc as any).fileUrl || `http://localhost:4000/api/v1/media/${(doc as any).storageKey || doc.id}`;
                        void navigator.clipboard.writeText(url);
                        setToast(`URL Media disalin: ${url}`);
                        setTimeout(() => setToast(""), 3500);
                      }}
                      title="Salin URL file media ini untuk dipakai di Flow WhatsApp atau pesan CS"
                    >
                      📋 Salin URL Media
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void extractCatalog(doc.id)}
                    title="Ekstrak daftar harga layanan ke database Katalog Produk"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                    Ekstrak Katalog
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={viewLoading}
                    onClick={() => void viewDocDetail(doc.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Lihat Isi
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void reindex(doc.id)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reindex
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void remove(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal Upload/Attach Foto Knowledge Base */}
      {showImgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <h3 className="font-display text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-purple-600" />
                Tambah Foto ke Knowledge Base
              </h3>
              <button onClick={() => setShowImgModal(false)} className="text-xs text-[var(--color-muted)] font-bold">
                ✕
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Nama Gambar / Label Foto (Misal: Brosur Pricelist Roti / Denah Lokasi Klinik)
              </label>
              <Input
                value={imgName}
                onChange={(e) => setImgName(e.target.value)}
                placeholder="Cth: Brosur Pricelist Hemat 2026"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                URL Foto atau Unggah File Gambar
              </label>
              <div className="flex gap-2">
                <Input
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  placeholder="https://.../brosur-paket.jpg"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => imgUploadRef.current?.click()}
                >
                  Pilih File
                </Button>
                <input
                  ref={imgUploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadMediaFiles(e.target.files!);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                Keterangan / Caption WA saat AI Mengirim Foto Ini
              </label>
              <Textarea
                rows={3}
                value={imgCaption}
                onChange={(e) => setImgCaption(e.target.value)}
                placeholder="Cth: Berikut brosur daftar harga promo paket hemat kami Kak! 😊"
              />
            </div>

            {agents.length > 0 ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
                  Hubungkan ke AI Agent Tertentu (Opsional)
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-xs"
                >
                  <option value="">Semua AI Agent (Default)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-line)]">
              <Button variant="ghost" onClick={() => setShowImgModal(false)}>
                Batal
              </Button>
              <Button disabled={busy} onClick={() => void handleAddImageDoc()}>
                {busy ? "Menyimpan…" : "Simpan Foto Knowledge"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* View Document Content Modal */}
      {selectedDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-2xl p-6 shadow-2xl max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[var(--color-accent)]" />
                  {selectedDoc.title}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                  <Badge tone={statusTone(selectedDoc.status)}>
                    {statusLabel(selectedDoc.status)}
                  </Badge>
                  <span className="uppercase">{selectedDoc.sourceType}</span>
                  <span>·</span>
                  <span>{selectedDoc.chunkCount ?? 0} Chunks</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-2)] p-4 text-xs font-mono text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap">
              {selectedDoc.content || "Tidak ada konten teks ditemukan."}
            </div>

            <div className="flex items-center justify-end border-t border-[var(--color-line)] pt-3">
              <Button onClick={() => setSelectedDoc(null)}>Tutup</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
