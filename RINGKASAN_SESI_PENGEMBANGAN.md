# Ringkasan Sesi Pembangunan & Instruksi AI Agent (Senja CS)

---

## 🚀 1. Fitur Utama yang Selesai Dibangun di Sesi Ini

### A. Hybrid WhatsApp Engine Architecture (Driver/Adapter Pattern)
- **Kontrak Driver (`apps/api/src/wa/types.ts`)**: Interface `IWaDriver` standar untuk semua driver WA.
- **Baileys Driver (`apps/api/src/wa/drivers/baileys.driver.ts`)**: Mengkapsulasi direct socket protocol via `sanka-baileyss`.
- **Open-WA Driver (`apps/api/src/wa/drivers/openwa.driver.ts`)**: REST Client & Webhook receiver untuk Open-WA Chromium Daemon.
- **WaManager Orchestrator (`apps/api/src/wa/manager.ts`)**: Driver Factory yang menginisialisasi driver sesuai field `engine` pada DB session.
- **API & Webhook Routes (`apps/api/src/routes/wa.ts`)**: Endpoint `POST /api/wa/sessions` (opsi `engine`) & `POST /api/wa/openwa-webhook`.
- **Docker Compose (`docker-compose.yml`)**: Container `openwa` (`openwa/wa-automate:latest`) pada port 8008 & volume `openwa_sessions`.
- **Web UI Channels (`apps/web/src/app/(app)/channels/page.tsx`)**: Pemilih Engine WA (Baileys vs Open-WA Stealth) di Dashboard.

### B. 100% Automated AI Ordering & Booking Module (Native LLM Function Calling)
- **Database Model**: Menambahkan `enum BookingStatus` & `model Booking` pada `apps/api/prisma/schema.prisma` (DB disinkronkan via `pnpm db:push`).
- **Modul Booking (`apps/api/src/tools/booking.ts`)**: Fungsi `createBookingDraft` dan `listBookings`.
- **JSON Tool Schemas (`apps/api/src/tools/schemas.ts`)**: Definisi skema `create_order`, `create_booking`, `check_catalog`, `get_payment_info`, `get_order_status`.
- **Native LLM Loop (`apps/api/src/lib/llm.ts` & `apps/api/src/bot/reply.ts`)**: `chatComplete` dan `runBotReply` memproses `toolCalls` AI secara aman dengan penanganan `try/catch`.

### C. Integrasi Payment Gateway Midtrans Sandbox & Webhook Auto-Confirm (B3)
- **Client Helper (`apps/api/src/lib/midtrans.ts`)**: Pembuatan transaksi Snap/QRIS Dinamis & verifikasi hash signature SHA-512.
- **Webhook Route (`apps/api/src/routes/payments.ts`)**: Endpoint `POST /api/payments/midtrans-webhook` yang otomatis mengubah status `Order` ke `paid` dan memicu pengiriman **Auto-Nota Pelunasan Lunas (Fitur B3)** ke WA pelanggan.
- **Commerce Integration (`apps/api/src/tools/commerce.ts`)**: Generator invoice WA otomatis menyertakan Tautan Bayar Instan Midtrans.
- **Ngrok Tunneling**: Ngrok aktif membentangkan port 4000:
  `https://30aa-2404-c0-be01-9e44-e47b-58b6-9e47-fe09.ngrok-free.app/api/payments/midtrans-webhook`

### D. Redesain Landing Page (Impeccable Design Standard)
- **[landing-page.tsx](file:///d:/customer-service/apps/web/src/components/landing/landing-page.tsx)**:
  - Interactive Hero Chat Simulator (Tab switcher: Auto-Order vs Auto-Nota B3).
  - Bento Grid Layout Asimetris (Hybrid Engine, Auto-Ordering/Booking AI, Auto-Nota B3, Multi-Agent Console, Knowledge RAG).
  - Desain Anti-Slop (kontras tinggi WCAG AA, font display Fraunces, tanpa gradient text / side-stripes).

### G. Dashboard Live Analytics, Funnel, & Leaderboard Agen
- **Backend API (`apps/api/src/routes/inbox.ts`)**: Endpoint `GET /api/v1/metrics/analytics` yang menghitung tren harian (chat masuk vs omzet paid), Funnel konversi (`Chat ➔ Bot ➔ Order Draft ➔ Paid`), dan Leaderboard Performa Agen.
- **Frontend Dashboard (`apps/web/src/app/(app)/dashboard/page.tsx`)**: Menampilkan Bar Chart Tren 7 Hari, Progress Funnel Konversi Visual, dan Tabel Peringkat Agen CS.

### J. CRM Lite & Customer Tagging (`/contacts`)
- **Backend API (`apps/api/src/routes/contacts.ts`)**: Endpoints `GET /contacts`, `GET /contacts/:id`, & `PATCH /contacts/:id/tags` dengan kalkulasi LTV (*Lifetime Value* / Total Omzet Lunas), order count, & booking count.
- **Frontend Dashboard (`apps/web/src/app/(app)/contacts/page.tsx`)**: Halaman manajemen kontak pelanggan, modal Tag Editor visual (menambah tag `#vip`, `#pasien`, `#reseller` yang terhubung langsung ke Broadcast WA Blast), modal riwayat transaksi, dan link navigasi di Sidebar.

### K. Export Laporan CSV (`/orders` & `/bookings`)
- **Endpoints CSV (`commerce.ts` & `bookings.ts`)**: `GET /orders/export-csv` dan `GET /bookings/export-csv`.
- **Frontend Web**: Tombol **Export CSV** di header halaman Pesanan & Booking.

---

## 📌 2. Status Verifikasi & Kualitas Kode

- `pnpm typecheck`: **100% BEBAS ERROR** across `@cs/shared`, `@cs/web`, `@cs/api`.
- `pnpm db:push`: Database PostgreSQL (`localhost:5434`) ter-sync sempurna.
- `docker compose ps`: Container `postgres` (port 5434), `redis` (port 6380), dan `openwa` (port 8008) dalam kondisi **Up (Aktif)**.

---

## 🤖 3. Instruksi Khusus untuk AI Agent Selanjutnya (Next Agent Instructions)

Jika Anda adalah AI Agent yang melanjutkan percakapan atau sesi baru di repositori ini, harap perhatikan poin-poin berikut:

1. **JANGAN Merusak Arsitektur Hybrid Driver (`IWaDriver`)**:
   - `WaManager` di `apps/api/src/wa/manager.ts` berfungsi sebagai orchestrator.
   - Apabila menambahkan metode baru pada WhatsApp (seperti kirim audio/lokasi), selalu perbarui kontrak `IWaDriver` di `apps/api/src/wa/types.ts` terlebih dahulu, lalu implementasikan di `baileys.driver.ts` dan `openwa.driver.ts`.

2. **JANGAN Menghapus Handler Midtrans Webhook**:
   - Endpoint `POST /api/payments/midtrans-webhook` di `apps/api/src/routes/payments.ts` bertugas menerima notifikasi pembeli bayar di Midtrans Sandbox dan memicu **Fitur B3 (Auto-Nota Pelunasan)**.

3. **Gunakan Pattern RAG + LLM Tool Calling pada Bot**:
   - `runBotReply` di `apps/api/src/bot/reply.ts` menggunakan skema tools di `apps/api/src/tools/schemas.ts`. Jika ingin menambah tool baru (seperti cek ongkir/resik ekspedisi), tambahkan skemanya di `schemas.ts` dan eksekutornya di `tools/`.

4. **Kepatuhan Tipe & Verification Rule**:
   - Selalu jalankan `pnpm typecheck` setelah melakukan modifikasi kode TypeScript.

---

## 🧪 4. Panduan Pengujian Ngrok & Midtrans Sandbox Simulator (Live Test Guide)

Berikut adalah panduan **cara menguji pembayaran otomatis (Auto-Nota B3)** menggunakan Ngrok & Midtrans Sandbox:

### Langkah 1: Pastikan Ngrok Berjalan pada Port 4000
- Jalankan perintah di terminal:
  ```bash
  npx ngrok http 4000
  ```
- Salin URL HTTPS publik yang dihasilkan, contoh:
  `https://30aa-2404-c0-be01-9e44-e47b-58b6-9e47-fe09.ngrok-free.app`

### Langkah 2: Tempelkan Webhook URL di Dashboard Midtrans Sandbox
1. Masuk ke **[Dashboard Midtrans Sandbox](https://dashboard.sandbox.midtrans.com)**.
2. Buka menu **`SETTINGS`** ➔ **`Configuration`**.
3. Di kolom **`Payment Notification URL`**, tempelkan URL Ngrok Anda + `/api/payments/midtrans-webhook`:
   ```text
   https://30aa-2404-c0-be01-9e44-e47b-58b6-9e47-fe09.ngrok-free.app/api/payments/midtrans-webhook
   ```
4. Klik tombol **`SAVE`**.

### Langkah 3: Eksekusi Uji Coba Simulasi Pembayaran
1. **Buat Order via WhatsApp**:
   - Kirim chat di WA: `"Pesan 2 Kopi Susu"`.
   - AI Bot akan membalas dengan invoice draf + **💳 Tautan Bayar Instan Midtrans Sandbox**.
2. **Buka Simulator Midtrans**:
   - Buka **`https://simulator.sandbox.midtrans.com/qris/index`** (untuk QRIS) atau **`https://simulator.sandbox.midtrans.com/bca/va/index`** (untuk BCA VA).
3. **Simulasikan Pembayaran**:
   - Buka tautan bayar dari AI Bot ➔ Masukkan kode bayar/QRString di simulator ➔ Klik **Pay / Confirm Pay**.
4. **Verifikasi Hasil**:
   - Midtrans menembak Webhook ke Ngrok ➔ Server API Senja CS menerima notifikasi ➔ Status order berubah menjadi `paid` ➔ **Nota Pelunasan Lunas (Fitur B3) otomatis terkirim ke WhatsApp pelanggan**!

---

*File dokumentasi ini dibuat secara otomatis untuk menjamin keberlanjutan pengembangan Senja CS.*
