# 📄 Design Specification: AI Voice Note Transcribe & Multimodal Vision Image Reader

- **Date**: 2026-08-14
- **Status**: Approved by User
- **Target Components**: `apps/api` (WhatsApp Manager, Vision & Whisper Engine, Bot Reply) & `apps/web` (Inbox Audio & Vision UI)

---

## 🎯 **1. Goals & Overview**

Fitur ini memberikan kemampuan **Multimodal AI (Suara & Gambar)** pada platform Senja CS:
1. **WhatsApp Voice Note Auto-Transcribe**: AI Bot & CS Manusia dapat memahami pesan suara (`.ogg` / `.m4a`) yang dikirim pelanggan via OpenAI Whisper AI.
2. **Multimodal Vision Image Reader**: AI Bot dapat "melihat" dan membaca foto yang dikirim pelanggan (misal: Bukti Transfer Nota, Foto Produk Rusak, Resep, atau Tangkapan Layar) menggunakan **Claude 3.5 Sonnet Vision / GPT-4o Vision**.

---

## 🏗️ **2. Architecture & Data Flow**

### **A. Alur Pesan Suara (Voice Note)**
```
[ Pelanggan Kirim Voice Note (.ogg) ]
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 1. Engine Baileys (`wa/manager.ts`) unduh audio        │
│    ke `uploads/voice/`                                 │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 2. Whisper Transcriber (`lib/transcribe.ts`)           │
│    menghasilkan teks transkrip                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 3. Simpan Message `type: "audio"`                      │
│    body: "🎙️ [Voice Note]: <hasil transkrip>"          │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 4. AI Bot RAG (`reply.ts`) membaca teks transkrip ini   │
│    dan membalas obrolan pelanggan secara otomatis!    │
└────────────────────────────────────────────────────────┘
```

### **B. Alur Pesan Gambar (Multimodal Vision)**
```
[ Pelanggan Kirim Foto (Bukti Transfer / Produk) ]
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 1. Engine Baileys unduh foto ke `uploads/images/`      │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 2. Vision Engine (`lib/vision.ts`) mengirim gambar ke  │
│    Claude/GPT-4o Vision untuk dianalisis (OCR / Detail)│
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 3. Simpan Message `type: "image"`                      │
│    metadata.imageAnalysis: "Bukti Transfer Rp 250k"    │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 4. AI Bot RAG membaca deskripsi gambar dan membalas:   │
│    "Terima kasih, pembayaran Rp 250k sudah dikonfirmasi"│
└────────────────────────────────────────────────────────┘
```

---

## 🎨 **3. Component Design & Frontend UI (`/inbox`)**

### **A. Custom Voice Note Bubble Card**
- Pemutar Audio HTML5 🎙️ dengan Play/Pause & Durasi.
- Badge *"📝 Transkrip AI"* yang bisa diklik untuk memperluas/menyembunyikan teks transkrip.

### **B. Image Vision Badge**
- Menampilkan thumbnail gambar + Badge *"👁️ Analisis AI"* yang menampilkan hasil ekstraksi OCR / teks bukti transfer saat di-hover / diklik oleh agen CS.

---

## 🧪 **4. Testing & Error Handling**

- **Fallback Audio**: Jika transkripsi gagal/timeout, file audio tetap dapat diputar manual oleh CS manusia dengan opsi tombol *"Coba Transkrip Ulang"*.
- **Fallback Vision**: Jika Vision API offline, pesan gambar tetap ditampilkan secara normal dan AI Bot membalas ramah: *"Terima kasih gambarnya Kak, agen CS kami sedang mengecek foto tersebut ya 😊"*.
