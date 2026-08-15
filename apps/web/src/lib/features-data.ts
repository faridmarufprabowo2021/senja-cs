export type FeatureItem = {
  slug: string;
  category: string;
  title: string;
  tagline: string;
  description: string;
  badge: string;
  accentColor: string;
  iconName: string;
  keyBenefits: string[];
  howItWorks: Array<{
    step: string;
    title: string;
    description: string;
  }>;
  useCases: Array<{
    title: string;
    scenario: string;
    outcome: string;
  }>;
  samplePayload?: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
};

export const FEATURES_DATA: FeatureItem[] = [
  {
    slug: "ai-chatbot",
    category: "Otomasi Percakapan",
    title: "AI Chatbot & Knowledge RAG Engine",
    tagline: "Asisten CS cerdas yang memahami katalog, SOP, dan dokumen bisnis Anda secara instan 24/7",
    description:
      "Senja CS menggunakan arsitektur Dual-Failover LLM (Llama 3.3 70B & Claude) yang terhubung langsung ke Knowledge Base terenkripsi. AI tidak sekadar membalas salam, melainkan mampu menjawab pertanyaan spesifik dari dokumen PDF, spreadsheet harga, hingga transkrip video YouTube.",
    badge: "Utama",
    accentColor: "sky",
    iconName: "Bot",
    keyBenefits: [
      "Respons instan dalam waktu kurang dari 2 detik tanpa jeda manual",
      "Dukungan multi-bahasa Indonesia & Inggris kontekstual ramah pelanggan",
      "Pembaruan dokumen pengetahuan instan tanpa perlu re-training model",
      "Eskalasi otomatis ke agen manusia jika persentase keyakinan di bawah ambang batas",
    ],
    howItWorks: [
      {
        step: "01",
        title: "Unggah Dokumen / Katalog",
        description: "Upload file PDF, Excel, URL website, atau video penjelasan produk ke Knowledge Base.",
      },
      {
        step: "02",
        title: "Vektor HNSW Auto-Indexing",
        description: "Dokumen dipotong menjadi chunk cerdas & di-indeks ke pgvector HNSW database.",
      },
      {
        step: "03",
        title: "Eksekusi Balasan Kontekstual",
        description: "Saat pesan masuk via WA/Instagram, AI mencari jawaban paling relevan secara presisi.",
      },
    ],
    useCases: [
      {
        title: "Toko Fashion & E-Commerce",
        scenario: "Pelanggan menanyakan ketersediaan ukuran M baju batik dan varian warna yang tersisa.",
        outcome: "AI mengecek stok katalog real-time dan memberikan foto produk beserta link pemesanan.",
      },
      {
        title: "Klinik & Layanan Kesehatan",
        scenario: "Pasien menanyakan syarat pemeriksaan konsultasi dan lokasi cabang terdekat.",
        outcome: "AI memberikan penjelasan syarat medis dari dokumen SOP klinik secara akurat.",
      },
    ],
    stats: [
      { label: "Waktu Balas Rata-rata", value: "< 1.8 dtk" },
      { label: "Akurasi Jawaban SOP", value: "98.4%" },
      { label: "Penghematan Beban Admin", value: "75%" },
    ],
  },
  {
    slug: "ai-booking",
    category: "Reservasi & Jadwal",
    title: "AI Booking & Reschedule Otomatis",
    tagline: "Kelola jadwal reservasi pelanggan tanpa bentrok dan izinkan reschedule instan via chat",
    description:
      "Fitur reservasi otomatis yang terhubung ke kalender interaktif. AI dapat mendaftarkan jadwal reservasi baru, mengecek bentrokan slot waktu dokter/beautician, dan menangani ganti jadwal (reschedule) sekaligus mengubah nama tindakan/layanan secara otomatis.",
    badge: "Populer",
    accentColor: "emerald",
    iconName: "Calendar",
    keyBenefits: [
      "Deteksi bentrokan jadwal otomatis hingga menit terperinci",
      "Mendukung reschedule tanggal, jam, dan perubahaan nama layanan sekaligus",
      "Integrasi pengingat H-1 otomatis ke WhatsApp pelanggan",
      "Tampilan Kalender & List Jadwal terpusat di dashboard admin",
    ],
    howItWorks: [
      {
        step: "01",
        title: "Permintaan Pelanggan",
        description: "Pelanggan meminta booking 'Konsultasi Behel besok jam 2 siang'.",
      },
      {
        step: "02",
        title: "Validasi Conflict Engine",
        description: "Sistem mengecek ketersediaan dokter dan slot waktu di database.",
      },
      {
        step: "03",
        title: "Konfirmasi & Reschedule",
        description: "Jadwal diterbitkan. Jika pelanggan minta ubah hari, AI langsung meng-update jadwal.",
      },
    ],
    useCases: [
      {
        title: "Klinik Gigi & Kecantikan",
        scenario: "Pasien membatalkan scaling gigi H-2 jam dan minta digeser ke Sabtu depan.",
        outcome: "AI memperbarui slot waktu dan mengubah jenis layanan di kalender tanpa campur tangan admin.",
      },
      {
        title: "Salon & Barbershop",
        scenario: "Pelanggan reservasi potong rambut untuk 2 orang sekaligus di jam 16.00.",
        outcome: "AI mengonfirmasi slot kapster dan mencatat nama masing-masing pemesan.",
      },
    ],
    stats: [
      { label: "Bentrokan Jadwal", value: "0%" },
      { label: "Tingkat Kehadiran H-1", value: "94.8%" },
      { label: "Waktu Reschedule", value: "3 dtk" },
    ],
  },
  {
    slug: "auto-nota-payment",
    category: "Keuangan & Kasir",
    title: "B3 Auto-Nota & Payment Gateway",
    tagline: "Terbitkan nota digital PDF otomatis dan verifikasi pembayaran QRIS / VA tanpa cek mutasi manual",
    description:
      "Mengubah percakapan penjualan menjadi transaksi lunas dalam hitungan detik. Senja CS terintegrasi dengan Payment Gateway Midtrans untuk menerbitkan QRIS & Virtual Account otomatis, serta langsung mengirimkan Nota Invoice B3 resmi berformat PDF ke WhatsApp begitu transaksi settlement.",
    badge: "Otomatis B3",
    accentColor: "indigo",
    iconName: "Receipt",
    keyBenefits: [
      "Generasi Link QRIS & Virtual Account BCA, Mandiri, BNI, BRI otomatis di chat",
      "Verifikasi callback settlement real-time (Auto-Lunas)",
      "Penerbitan Nota Invoice PDF profesional berstempel lunas",
      "Rekap omset & laporan keuangan harian dalam satu klik",
    ],
    howItWorks: [
      {
        step: "01",
        title: "Buat Draft Order",
        description: "Pelanggan menyetujui rincian barang / jasa yang dipesan.",
      },
      {
        step: "02",
        title: "Kirim QRIS / Payment Link",
        description: "AI membuatkan link pembayaran Midtrans yang berlaku 24 jam.",
      },
      {
        step: "03",
        title: "Auto-Nota B3 PDF",
        description: "Saat pembayaran masuk, sistem langsung mengirim nota lunas PDF ke WhatsApp.",
      },
    ],
    useCases: [
      {
        title: "Toko Kuliner & Bakery",
        scenario: "Pelanggan memesan 5 box Roti Abon dan membayar via QRIS.",
        outcome: "Pembayaran terverifikasi detik itu juga dan nota invoice B3 terkirim otomatis.",
      },
      {
        title: "Jasa Konsultasi & Agency",
        scenario: "Klien membayar uang muka (DP) jasa desain via Virtual Account Mandiri.",
        outcome: "Status order berubah ke 'Paid' dan invoice resmi tercetak di dashboard.",
      },
    ],
    stats: [
      { label: "Waktu Verifikasi Bayar", value: "Instant" },
      { label: "Kesalahan Rekap Nota", value: "0%" },
      { label: "Peningkatan Conversions", value: "+38%" },
    ],
  },
  {
    slug: "vision-ai-ocr",
    category: "Multimodal AI",
    title: "Vision AI OCR & Voice Note Transcribe",
    tagline: "AI yang bisa melihat foto bukti transfer, membaca gambar produk, dan mendengar pesan suara",
    description:
      "Senja CS tidak hanya membaca teks biasa. Dengan teknologi Vision AI (Llama 3.2 11B Vision) dan Speech Recognition (Whisper Large v3), AI dapat menganalisis isi foto yang dikirim pelanggan dan men-transkripsi voice note bahasa Indonesia menjadi balasan teks yang akurat.",
    badge: "Multi-Modal",
    accentColor: "purple",
    iconName: "Eye",
    keyBenefits: [
      "Membaca tulisan pada foto bukti transfer bank & struk pembayaran",
      "Mengidentifikasi foto produk komplain atau barang rusak secara visual",
      "Mendengar dan memahami voice note pelanggan berdurasi hingga 3 menit",
      "Mengubah voice note menjadi rangkuman teks terstruktur di inbox admin",
    ],
    howItWorks: [
      {
        step: "01",
        title: "Penerimaan Foto / Suara",
        description: "Pelanggan mengirim foto barang atau voice note di WhatsApp.",
      },
      {
        step: "02",
        title: "Pemrosesan Vision & Whisper Engine",
        description: "Model Vision menganalisis visual foto dan Whisper mentranskripsi audio.",
      },
      {
        step: "03",
        title: "Tindakan Cerdas AI",
        description: "AI membalas informasi produk berdasarkan foto atau ringkasan pesan suara.",
      },
    ],
    useCases: [
      {
        title: "Toko Sparepart & Elektronik",
        scenario: "Pelanggan mengirim foto komponen mesin dan bertanya ketersediaan suku cadang.",
        outcome: "AI mengenali jenis komponen pada foto dan memberikan rekomendasi dari katalog.",
      },
      {
        title: "Pelanggan Sibuk / Pengemudi",
        scenario: "Pelanggan mengirim pesan suara 45 detik saat berada di jalan.",
        outcome: "AI mendengar isi pesan suara dan membalas pertanyaan pesanan secara akurat.",
      },
    ],
    stats: [
      { label: "Transkripsi Audio", value: "< 2 dtk" },
      { label: "Akurasi OCR Struk", value: "96.5%" },
      { label: "Dukungan Bahasa", value: "ID & EN" },
    ],
  },
  {
    slug: "daily-executive-report",
    category: "Pelaporan & Insights",
    title: "Automated Daily Executive Report",
    tagline: "Laporan performa bisnis harian yang dikirim otomatis setiap malam ke Telegram & WA Owner",
    description:
      "Pemilik bisnis tidak perlu lagi merekap data penjualan secara manual di akhir hari. Setiap malam (default jam 21.00 WIB), Senja CS secara otomatis merangkum total chat, closing penjualan, omset, jadwal booking, Top 3 pertanyaan pelanggan, dan rekomendasi strategi AI langsung ke ponsel Owner.",
    badge: "Fitur Eksekutif",
    accentColor: "sky",
    iconName: "TrendingUp",
    keyBenefits: [
      "Pengiriman otomatis setiap malam via Telegram Bot API & WhatsApp",
      "Ringkasan omset bersih, total transaksi closing, dan jumlah booking harian",
      "Analisis Top 3 FAQ yang paling banyak ditanyakan pelanggan",
      "Rekomendasi strategi bisnis otomatis hasil kompilasi AI Insights Engine",
    ],
    howItWorks: [
      {
        step: "01",
        title: "Agregasi Data Harian",
        description: "Sistem mengumpulkan seluruh data transaksi, chat, dan analisis sentimen harian.",
      },
      {
        step: "02",
        title: "Penyusunan Executive Summary",
        description: "AI Insights Engine menyusun rangkuman angka kunci dan masukan bisnis.",
      },
      {
        step: "03",
        title: "Pengiriman Otomatis",
        description: "Laporan dikirim secara tepat waktu ke Telegram Bot atau WA Owner.",
      },
    ],
    useCases: [
      {
        title: "Pemilik Klinik Gigi",
        scenario: "Dokter owner sibuk menangani pasien sepanjang hari.",
        outcome: "Jam 21.00 malam mendapatkan laporan lengkap omset & daftar reservasi hari ini via Telegram.",
      },
      {
        title: "Manager Operasional Retail",
        scenario: "Memantau performa 5 cabang toko online secara bersamaan.",
        outcome: "Menerima analisis Top FAQ pelanggan untuk mengevaluasi strategi stok barang.",
      },
    ],
    stats: [
      { label: "Penghematan Rekap", value: "100%" },
      { label: "Waktu Pengiriman", value: "Tepat Waktu" },
      { label: "Saluran", value: "TG & WA" },
    ],
  },
  {
    slug: "kanban-crm",
    category: "Manajemen Pelanggan",
    title: "Kanban Deals Pipeline & CRM",
    tagline: "Pantau alur konversi prospek dari Lead Baru, Penawaran, hingga Closing dalam tampilan visual",
    description:
      "Sistem CRM terpadu yang memadukan obrolan WhatsApp dengan papan Kanban visual. Setiap kontak pelanggan dapat dikategorikan ke dalam stage (Lead Baru, Prospek Panas, Penawaran, Closing, Follow-Up) lengkap dengan nilai deal dan label tag khusus.",
    badge: "CRM Visual",
    accentColor: "amber",
    iconName: "Columns",
    keyBenefits: [
      "Papan Kanban Drag & Drop untuk menggeser status deal pelanggan",
      "Estimasi total nilai pipeline penjualan real-time",
      "Tagging kontak otomatis (Voucher, Booking, Pelanggan VIP)",
      "Navigasi cepat 1-klik dari kartu deal langsung ke room Inbox chat",
    ],
    howItWorks: [
      {
        step: "01",
        title: "Auto Lead Entry",
        description: "Kontak baru yang bertanya di WA otomatis tercatat di kolom Lead Baru.",
      },
      {
        step: "02",
        title: "Pembaruan Stage Cerdas",
        description: "Saat booking atau order dibuat, stage deal berpindah otomatis.",
      },
      {
        step: "03",
        title: "Manajemen Tim CS",
        description: "Admin dapat menggeser deal dan menambahkan catatan internal kontak.",
      },
    ],
    useCases: [
      {
        title: "Tim Sales Property & Otomotif",
        scenario: "Mengelola 500+ prospek yang menanyakan brosur unit kendaraan.",
        outcome: "Prospek terorganisir rapi berdasarkan nilai potensi closing.",
      },
      {
        title: "Jasa B2B & Distribution",
        scenario: "Menindaklanjuti penawaran harga ke 50 akun perusahaan.",
        outcome: "Tim sales mengetahui persis kapan harus melakukan follow-up.",
      },
    ],
    stats: [
      { label: "Lead Tracking", value: "100%" },
      { label: "Visibilitas Deal", value: "Real-time" },
      { label: "Penilaian Pipeline", value: "Otomatis" },
    ],
  },
  {
    slug: "logistics-tracking",
    category: "Pengiriman & Logistik",
    title: "Cek Ongkir 10+ Kurir & Lacak Resi",
    tagline: "Hitung tarif ongkir otomatis di chat dan lacak perjalanan paket pelanggan secara real-time",
    description:
      "Menghilangkan pertanyaan berulang 'Ongkir ke daerah ini berapa?' dan 'Paket saya sudah sampai mana?'. Senja CS terhubung dengan API Binderbyte & RajaOngkir untuk menghitung tarif pengiriman 10+ kurir nasional dan melacak status resi kurir di dalam chat.",
    badge: "10+ Ekspedisi",
    accentColor: "rose",
    iconName: "Truck",
    keyBenefits: [
      "Hitung ongkir instan untuk JNE, J&T, SiCepat, Paxel, Pos, Anteraja, Ninja, dll",
      "Pilihan lokasi asal pengiriman toko yang dapat dikonfigurasi di settings",
      "Lacak posisi terkini paket berdasarkan nomor resi di chat",
      "Penghematan waktu admin dari menjawab pertanyaan cek ongkir manual",
    ],
    howItWorks: [
      {
        step: "01",
        title: "Pertanyaan Ongkir",
        description: "Pelanggan menanyakan ongkir dari toko Anda ke kecamatan tujuan.",
      },
      {
        step: "02",
        title: "Eksekusi API Logistik",
        description: "AI memanggil tool cek ongkir berdasarkan berat barang dan kota tujuan.",
      },
      {
        step: "03",
        title: "Opsi Tarif Lengkap",
        description: "AI menampilkan rincian opsi tarif REG, YES, dan Cargo secara rapi.",
      },
    ],
    useCases: [
      {
        title: "Toko Online Pakaian & Sepatu",
        scenario: "Pembeli dari Medan ingin tahu biaya J&T REG dan SiCepat BEST.",
        outcome: "AI menyajikan perbandingan harga dan estimasi hari sampai secara instan.",
      },
      {
        title: "Distributor Makanan Beku (Frozen)",
        scenario: "Pembeli meminta ekspedisi sameday Paxel / Instant.",
        outcome: "AI menampilkan opsi ongkir sameday yang tersedia.",
      },
    ],
    stats: [
      { label: "Ekspedisi Terhubung", value: "10+ Kurir" },
      { label: "Waktu Cek Resi", value: "< 1 dtk" },
      { label: "Akurasi Tarif", value: "100%" },
    ],
  },
  {
    slug: "webhook-api",
    category: "Ekosistem & Integrasi",
    title: "Outbound Webhooks & Open REST API",
    tagline: "Hubungkan Senja CS ke software bisnis, Zapier, Make, n8n, atau database internal Anda",
    description:
      "Platform Senja CS dibangun di atas ekosistem terbuka. Anda dapat menghubungkan event percakapan, booking baru, dan order lunas ke software kasir POS, CRM kustom, Laravel, NestJS, atau Google Sheets menggunakan Outbound Webhooks dan REST API Key.",
    badge: "Open API",
    accentColor: "cyan",
    iconName: "Code2",
    keyBenefits: [
      "Outbound Webhooks real-time saat event booking, order, & pesan dibuat",
      "Visual Flow Webhook Node untuk menembak API di tengah alur kuesioner",
      "Inbound REST API Endpoint dengan keamanan API Key",
      "Integrasi tanpa koding ke Google Sheets, Zapier, Make.com, & n8n",
    ],
    howItWorks: [
      {
        step: "01",
        title: "Daftarkan Endpoint URL",
        description: "Masukkan URL webhook software bisnis Anda di menu Settings.",
      },
      {
        step: "02",
        title: "Event Trigger",
        description: "Setiap ada booking atau order lunas, Senja CS menembak payload JSON.",
      },
      {
        step: "03",
        title: "Database Sync",
        description: "Server bisnis Anda membaca JSON dan meng-update database internal.",
      },
    ],
    useCases: [
      {
        title: "Perusahaan Software & SaaS",
        scenario: "Menyinkronkan data pemesan WhatsApp ke CRM Salesforce / HubSpot internal.",
        outcome: "Data lead dan nilai transaksi terbebas dari kesalahan entri manual.",
      },
      {
        title: "UMKM Tanpa Tim Koding",
        scenario: "Mengirimkan seluruh data kuesioner pelanggan ke Google Sheets.",
        outcome: "Data kuesioner tersusun rapi di baris Google Sheets secara otomatis.",
      },
    ],
    stats: [
      { label: "Kecepatan Webhook", value: "< 500 ms" },
      { label: "Uptime Webhook", value: "99.9%" },
      { label: "Format Data", value: "JSON Clean" },
    ],
  },
];
