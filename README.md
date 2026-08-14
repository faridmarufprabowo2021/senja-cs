# 🚀 Senja CS — Platform Omnichannel Customer Service & AI Sales Platform

![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![Fastify](https://img.shields.io/badge/Fastify-5.0-green?style=flat-square&logo=fastify)
![Prisma](https://img.shields.io/badge/Prisma-ORM-blue?style=flat-square&logo=prisma)
![WhatsApp Baileys](https://img.shields.io/badge/WhatsApp-Baileys%20Engine-25D366?style=flat-square&logo=whatsapp)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)

**Senja CS** adalah platform SaaS omnichannel terpadu (*End-to-End Customer Service & AI Sales Automation*) yang dirancang khusus untuk membantu bisnis dan UMKM mengelola obrolan pelanggan dari **WhatsApp** dan **Instagram DM** dalam satu dashboard pintar. 

Platform ini dilengkapi dengan **AI Orchestrator Engine**, **Vector Search Knowledge Base (RAG)**, **Kanban CRM Pipeline**, **Otomatisasi Flow Chat**, **Lacak Resi & Cek Ongkir Multi-Ekspedisi**, serta **Auto-Generate QRIS & Nota Lunas**.

---

## 📑 Daftar Isi

1. [Arsitektur & Tech Stack](#-arsitektur--tech-stack)
2. [Fitur-Fitur Utama Platform](#-fitur-fitur-utama-platform)
3. [Struktur Monorepo & Direktori](#-struktur-monorepo--direktori)
4. [Panduan Instalasi & Persiapan Lokal](#-panduan-instalasi--persiapan-lokal)
5. [Skema Database & Model Utama](#-skema-database--model-utama)
6. [Skema AI Orchestrator & RAG Engine](#-skema-ai-orchestrator--rag-engine)
7. [Panduan Deployment (Produksi)](#-panduan-deployment-produksi)

---

## 🏗️ Arsitektur & Tech Stack

Senja CS dibangun dengan arsitektur **Monorepo** modern menggunakan **pnpm workspaces** dan **Turborepo** untuk performa tinggi dan penggunaan memori yang efisien:

* **Frontend Web App (`apps/web`)**: Next.js 15 (App Router), TailwindCSS, Framer Motion, Lenis Smooth Scroll, Lucide Icons, Web Audio Synthesizer Chime API.
* **Backend API Server (`apps/api`)**: Fastify 5, Node.js 20+, WebSocket (`ws`), Prisma ORM.
* **Database & Vector Engine**: PostgreSQL 16 dengan ekstensi **`pgvector`** (untuk RAG vector embeddings obrolan & dokumen pengetahuan).
* **WhatsApp Engine**: **sanka-baileyss** (Pustaka open-source koneksi WebSocket langsung — *100% Gratis Tanpa Batas Pesan & Tanpa Perantara Broker*).
* **Omnichannel Integration**: Meta Graph API & Webhook untuk Instagram DM.
* **Payment Gateway**: Midtrans (Auto Payment Notification & Generation QRIS).
* **Shared Types (`packages/shared`)**: Tipe data TypeScript terpusat yang digunakan bersama oleh backend API dan frontend Web.

---

## 🌟 Fitur-Fitur Utama Platform

### 💬 1. Unified Omnichannel Multi-Agent Inbox (`/inbox`)
- **Dashboard Terpadu**: Menggabungkan seluruh obrolan masuk dari berbagai saluran (WhatsApp & Instagram DM) ke dalam satu tampilan inbox *real-time*.
- **Multi-Agent Assignment**: Fitur pengalihan (*claim/assign*) obrolan ke staf CS manusia tertentu dalam tim.
- **Indikator Visual AI Agent (`🤖 Bot AI`)**: Menampilkan badge nama AI Agent spesialis yang sedang menangani obrolan secara *live* pada sidebar & header percakapan.
- **Manajemen Label/Tags**: Memudahkan pengelompokan pelanggan (`hot`, `komplain`, `order`, `followup`).
- **Web Audio Chime & Push Notification**: Notifikasi suara lonceng sintetis dan push notification di browser desktop saat ada chat masuk baru di latar belakang.

---

### 🧠 2. AI Orchestrator & Knowledge Base RAG Engine (`/bot` & `/knowledge`)
- **Master Intent Router (AI Orchestrator)**: Menganalisis topik percakapan pelanggan dan secara otomatis mengarahkan obrolan ke AI Agent spesialis yang paling tepat (*Sales Agent*, *Booking Agent*, *Support Agent*).
- **Global Knowledge Fallback**: Jika pemilik toko tidak mengatur agent spesifik, AI secara cerdas beralih ke *Global AI Agent* yang membaca seluruh dokumen *Knowledge Base* toko tanpa error (*Zero-Config Friendly*).
- **Indexing Multiformat (RAG)**: Mengindeks dokumen pengetahuan berbentuk PDF, TXT, FAQ, dan Gambar ke dalam vektor embedding PostgreSQL (`pgvector`).
- **Auto Image Media Injection**: AI Bot secara otomatis melampirkan foto produk/brosur gambar yang relevan ke WhatsApp pelanggan saat menjelaskan produk.

---

### 🔄 3. Seamless Human Handoff (`escalate()`)
- AI Bot secara otomatis mendeteksi ketika pelanggan meminta berbicara dengan CS manusia (*"mau bicara dengan CS"*) atau ketika terjadi indikasi keluhan/frustrasi.
- Obrolan dialihkan ke agen CS manusia dengan pengiriman notifikasi suara *real-time*, dan seluruh **riwayat percakapan + rangkuman AI** diberikan utuh sehingga pelanggan tidak mengulang cerita dari awal.

---

### 🔀 4. Visual WhatsApp Auto-Flow Builder (`/settings/flows`)
- Papan diagram interaktif (*Visual Node Builder*) untuk merancang alur pesan otomatisasi berbasis keyword, menu pilihan, dan pengumpulan form data.

---

### 🎯 5. CRM & Visual Sales Pipeline (`/contacts` & `/pipeline`)
- **Auto Lead Capture**: Setiap obrolan dari nomor baru otomatis dicatat sebagai profil `Contact` di CRM.
- **AI Profile Extractor**: AI Bot secara otomatis mengekstrak Nama, Kota, dan Produk yang diminati pelanggan dari teks obrolan.
- **Papan Kanban Prospek**: Kartu transaksi bergerak secara otomatis melalui tahapan *Draft ➔ Contacted ➔ Qualified ➔ Negotiation ➔ Closed-Won*.

---

### 🚚 6. Cek Resi & Ongkir Multi-Ekspedisi (`/shipping`)
- **Cek Resi Pelanggan**: Lacak posisi paket secara *real-time* dari berbagai kurir (JNE, J&T, SiCepat, Pos Indonesia, dll).
- **Kalkulator Biaya Ongkir**: Hitung perbandingan tarif ongkir multi-ekspedisi dari kota asal ke tujuan lengkap dengan estimasi hari pengiriman.

---

### 🧾 7. Payment Gateway QRIS & Auto-Nota Lunas (`/orders` & `/settings/billing`)
- **Penjualan & Buat Order**: Agen CS / AI Bot dapat membuatkan draf transaksi dan menghasilkan **Kode QRIS Pembayaran**.
- **Fitur Auto-Nota Lunas (B3)**: Begitu pembayaran Midtrans berhasil (*settlement*), sistem backend otomatis mengubah status order menjadi `paid` dan **langsung menggenerasi PDF Nota Pembayaran** serta mengisikannya via WA ke pelanggan secara otomatis!

---

### 📊 8. Analytics & Leaderboard Tim CS (`/analytics`)
- **Grafik Tren Visual**: Visualisasi tren 7 hari untuk volume pesan masuk, jumlah order dibuat, order lunas, dan total omzet pendapatan.
- **Metrik CSAT & Resolusi Bot**: Grafik donut ring tingkat kepuasan pelanggan dan efisiensi balasan bot.
- **Leaderboard Agen CS**: Peringkat jumlah obrolan yang ditangani dan diselesaikan oleh masing-masing anggota tim CS.

---

## 📂 Struktur Monorepo & Direktori

```
customer-service/
├── apps/
│   ├── api/                  # Backend REST API Server (Fastify 5 + Prisma)
│   │   ├── prisma/           # Schema Database Prisma & Migrasi SQL
│   │   └── src/
│   │       ├── bot/          # AI Orchestrator, Reply Engine, & RAG Retriever
│   │       ├── channels/     # Driver Instagram DM & Meta Graph API
│   │       ├── lib/          # Helper Auth, Midtrans, Audio, & Mappers
│   │       ├── routes/       # API Routes (/inbox, /bot, /shipping, /orders)
│   │       ├── tools/        # Tool Internal AI (Commerce, Booking, Shipping)
│   │       └── wa/           # Engine WhatsApp Baileys Manager
│   └── web/                  # Frontend App (Next.js 15 App Router)
│       └── src/
│           ├── app/          # Next.js Pages & Layouts (/inbox, /pipeline, /analytics)
│           ├── components/   # Komponen UI (Inbox, Sidebar, AnalyticsCharts, Flow)
│           └── lib/          # Utilities, API client, & WebSocket Hooks
├── packages/
│   └── shared/               # Package Monorepo Tipe Data TypeScript Shared
├── package.json              # Workspace Root Dependencies & Scripts
├── turbo.json                # Konfigurasi Build Turborepo
└── README.md                 # Dokumentasi Resmi Proyek
```

---

## 🛠️ Panduan Instalasi & Persiapan Lokal

### Prasyarat System:
- **Node.js**: `v20.0.0` atau lebih baru.
- **pnpm**: `v9.0.0` atau lebih baru (`npm i -g pnpm`).
- **PostgreSQL**: `v16` dengan ekstensi `pgvector` aktif.

### Langkah-Langkah Running Lokal:

1. **Clone Repository & Install Dependencies**:
   ```bash
   git clone https://github.com/faridmarufprabowo2021/senja-cs.git
   cd senja-cs
   pnpm install
   ```

2. **Setup Konfigurasi Environment Variables (`.env`)**:
   Salin `.env.example` di folder `apps/api/.env`:
   ```env
   NODE_ENV=development
   API_PORT=4000
   DATABASE_URL=postgresql://cs:cs_secret@localhost:5432/customer_service
   JWT_SECRET=dev-jwt-secret-change-me-32chars
   CORS_ORIGIN=http://localhost:3001
   WEB_URL=http://localhost:3001
   LLM_BASE_URL=https://openagentic.id/api/v1
   LLM_CHAT_MODEL=claude-sonnet-4.5
   MIDTRANS_SERVER_KEY=SB-Mid-server-placeholder
   MIDTRANS_CLIENT_KEY=SB-Mid-client-placeholder
   ```

3. **Jalankan Database Migration & Seed**:
   ```bash
   pnpm --filter @cs/api prisma db push
   pnpm --filter @cs/api prisma db seed
   ```

4. **Jalankan Server API & Web App**:
   ```bash
   # Jalankan Server Backend API (:4000)
   pnpm --filter @cs/api dev

   # Jalankan Frontend Web Dashboard (:3001)
   pnpm --filter @cs/web dev
   ```

5. **Akses Dashboard Demo**:
   Buka browser di `http://localhost:3001`  
   - **Email Demo**: `sari@warungsenja.id`  
   - **Password Demo**: `demo1234`

---

## 🧪 Pengujian Typecheck Codebase

Untuk memastikan seluruh paket di monorepo bebas dari *type error*:

```bash
pnpm typecheck
```

---

## 📄 Lisensi

Hak Cipta © 2026 **Senja CS**. Hak cipta dilindungi undang-undang.
