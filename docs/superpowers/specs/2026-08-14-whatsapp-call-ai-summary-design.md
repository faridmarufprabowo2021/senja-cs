# 📄 Design Specification: WhatsApp Call AI Summary

- **Date**: 2026-08-14
- **Status**: Approved by User
- **Target Components**: `apps/api` (WhatsApp Call Listener, Call Summarizer Engine) & `apps/web` (Inbox Call Summary Card & CRM Sync)

---

## 🎯 **1. Goals & Overview**

Fitur **WhatsApp Call AI Summary** otomatis menangkap dan menganalisis panggilan telepon WhatsApp (panggilan masuk / terjawab) dan langsung menghasilkan kartu ringkasan eksekutif secara instan:
1. 📞 **Durasi & Status Panggilan**: Catatan durasi dan status telepon.
2. 📝 **Ringkasan AI (Call Summary)**: Rangkuman 2-3 kalimat mengenai isi percakapan telepon.
3. 📌 **Poin Penting (Key Takeaways)**: Kesepakatan harga, produk yang diminati, dan kendala pelanggan.
4. ⚡ **Rekomendasi Tindakan Lanjutan (Action Items)**: Daftar langkah selanjutnya (misal: *"Kirimkan draf penawaran sebelum hari Jumat"*).
5. 💾 **CRM & Reminder Sync**: Sinkronkan action items secara otomatis ke CRM pelanggan dan modul `/reminders`.

---

## 🏗️ **2. Architecture & Data Flow**

```
[ Panggilan Telepon WA Selesai ]
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ 1. Engine Baileys (`wa/manager.ts`) menangkap event    │
│    panggilan telepon (`call_ended`)                    │
└──────────────┬─────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ 2. Groq Whisper Transcriber (`lib/transcribe.ts`)      │
│    mentranskrip rekaman audio ke teks                  │
└──────────────┬─────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ 3. Call Summarizer Engine (`lib/call-summarizer.ts`)   │
│    menghasilkan JSON Ringkasan, Poin, & Action Items   │
└──────────────┬─────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│ 4. Simpan Message `type: "call_summary"`               │
│    dan tampilkan Kartu Rangkuman Telepon di `/inbox`   │
└────────────────────────────────────────────────────────┘
```

---

## 🎨 **3. Component Design & Frontend UI (`/inbox`)**

### **Kartu Ringkasan Telepon 📞 (WhatsApp Call AI Card)**
- Header: `📞 Panggilan WhatsApp Selesai (Durasi: 03:45)`
- Section 1: **📝 Ringkasan Executiv**: Teks ringkas pembicaraan.
- Section 2: **📌 Poin Penting**: Daftar kesepakatan & catatan utama.
- Section 3: **⚡ Langkah Selanjutnya (Action Items)** + Tombol *"➕ Jadwalkan Reminder Follow-Up"*.

---

## 🧪 **4. Testing & Error Handling**

- **Missed Call Handling**: Jika panggilan tidak terangkat / panggilan tak terjawab, sistem mencatat `📞 Panggilan Tak Terjawab` di Inbox agar agen CS dapat segera menelpon balik.
- **Fallback Summary**: Jika audio telepon sangat pendek (< 5 detik), AI menampilkan kartu singkat: *"Panggilan singkat (Kurang dari 5 detik)"*.
