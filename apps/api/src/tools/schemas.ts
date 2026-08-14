export const SYSTEM_TOOLS_DEFINITIONS = [
  {
    name: "create_order",
    description:
      "Buat draf pesanan/order produk barang untuk pelanggan dari chat WhatsApp. Panggil fungsi ini jika pengguna berniat memesan atau membeli barang.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Daftar item produk yang dipesan",
          items: {
            type: "object",
            properties: {
              productName: {
                type: "string",
                description: "Nama produk yang dipesan",
              },
              qty: {
                type: "number",
                description: "Jumlah/Kuantitas produk (default 1)",
              },
            },
            required: ["productName"],
          },
        },
        note: {
          type: "string",
          description: "Catatan tambahan pesanan (opsional, misal pedas/tanpa es)",
        },
      },
      required: ["items"],
    },
  },
  {
    name: "create_booking",
    description:
      "Buat draf reservasi/booking jadwal layanan atau jasa untuk pelanggan dari chat WhatsApp. Panggil jika pengguna berniat booking waktu/layanan.",
    parameters: {
      type: "object",
      properties: {
        serviceName: {
          type: "string",
          description: "Nama layanan/jasa yang ingin di-booking (misal: Potong Rambut, Servis AC, Konsultasi)",
        },
        bookingDateStr: {
          type: "string",
          description: "Tanggal & waktu booking dalam format ISO 8601 (misal 2026-08-10T14:00:00Z atau 2026-08-10 14:00)",
        },
        note: {
          type: "string",
          description: "Catatan tambahan booking (opsional)",
        },
      },
      required: ["serviceName", "bookingDateStr"],
    },
  },
  {
    name: "check_catalog",
    description: "Cari produk atau lihat daftar katalog barang/jasa.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Kata kunci nama produk yang dicari (opsional)",
        },
      },
    },
  },
  {
    name: "get_payment_info",
    description: "Ambil rincian instruksi pembayaran bank / nomor rekening / cara bayar.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "reschedule_booking",
    description:
      "Ubah/pindah jadwal (reschedule) atau ubah jenis layanan reservasi/booking pelanggan ke tanggal/jam/layanan baru. Panggil jika pelanggan ingin mengubah, menggeser, mereschedule jadwal, atau mengganti jenis layanan booking.",
    parameters: {
      type: "object",
      properties: {
        bookingId: {
          type: "string",
          description: "ID booking yang ingin diubah (opsional, jika tidak diisi akan memilih booking aktif pelanggan)",
        },
        newBookingDateStr: {
          type: "string",
          description: "Jadwal tanggal & jam BARU dalam format ISO 8601 atau teks (misal 2026-08-17 14:00 atau 2026-08-17T14:00:00Z)",
        },
        newServiceName: {
          type: "string",
          description: "Nama layanan/jasa BARU jika pelanggan juga ingin mengganti jenis tindakan/layanan (misal: Konsultasi Pemasangan Behel, Cabut Gigi, Scaling Gigi)",
        },
        reason: {
          type: "string",
          description: "Alasan perubahan atau catatan jadwal baru (opsional)",
        },
      },
      required: ["newBookingDateStr"],
    },
  },
  {
    name: "check_shipping_cost",
    description:
      "Hitung estimasi tarif ongkos kirim (ongkir) ekspedisi JNE, J&T, SiCepat, Paxel, dll berdasarkan kota/kecamatan tujuan dan berat barang.",
    parameters: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          description: "Nama kota, kabupaten, atau kecamatan tujuan pengiriman pelanggan",
        },
        weightGrams: {
          type: "number",
          description: "Berat total paket dalam gram (default 1000 gram)",
        },
        courier: {
          type: "string",
          description: "Pilihan kurir ekspedisi spesifik (opsional, misal jne, jnt, sicepat, paxel)",
        },
      },
      required: ["destination"],
    },
  },
  {
    name: "track_shipment",
    description:
      "Lacak lokasi posisi paket dan status pengiriman berdasarkan nomor resi ekspedisi.",
    parameters: {
      type: "object",
      properties: {
        waybillNumber: {
          type: "string",
          description: "Nomor resi pengiriman ekspedisi",
        },
        courier: {
          type: "string",
          description: "Nama ekspedisi (opsional, misal jne, jnt, sicepat, paxel)",
        },
      },
      required: ["waybillNumber"],
    },
  },
  {
    name: "cancel_booking_or_order",
    description:
      "Batalkan jadwal reservasi/booking atau pesanan draft yang belum dibayar milik pelanggan secara mandiri.",
    parameters: {
      type: "object",
      properties: {
        targetType: {
          type: "string",
          enum: ["booking", "order", "auto"],
          description: "Jenis yang ingin dibatalkan: 'booking', 'order', atau 'auto' (otomatis mendeteksi yang aktif)",
        },
        reason: {
          type: "string",
          description: "Alasan pembatalan (opsional)",
        },
      },
    },
  },
  {
    name: "get_product_recommendation",
    description:
      "Berikan rekomendasi produk atau paket hampers terbaik berdasarkan anggaran (maxPrice) dan jenis/kategori barang.",
    parameters: {
      type: "object",
      properties: {
        maxPrice: {
          type: "number",
          description: "Batas harga maksimal/budget pelanggan (misal 100000)",
        },
        category: {
          type: "string",
          description: "Kategori atau kata kunci produk/hampers yang dicari (opsional)",
        },
        occasion: {
          type: "string",
          description: "Acara/kebutuhan (misal ulang tahun, kado, snackbox) (opsional)",
        },
      },
    },
  },
  {
    name: "check_promo_discounts",
    description:
      "Cek daftar voucher diskon, potongan harga, dan promo gratis ongkir yang sedang aktif di toko. Panggil jika pelanggan bertanya tentang voucher, promo, diskon, atau potongan harga.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Kategori barang atau jenis promo yang dicari pelanggan (opsional)",
        },
      },
    },
  },
  {
    name: "check_invoice_status",
    description:
      "Cek status pembayaran tagihan/invoice dan instruksi link pembayaran milik pelanggan. Panggil jika pelanggan meminta rincian nota, status tagihan, atau link bayar.",
    parameters: {
      type: "object",
      properties: {
        invoiceNumber: {
          type: "string",
          description: "Nomor invoice atau ID pesanan (opsional, jika kosong akan mengecek tagihan aktif terakhir)",
        },
      },
    },
  },
  {
    name: "collect_feedback_review",
    description:
      "Simpan ulasan, nilai kepuasan (rating 1-5 bintang), dan masukan pelanggan tentang pengalaman belanja atau reservasi.",
    parameters: {
      type: "object",
      properties: {
        rating: {
          type: "number",
          description: "Skala rating kepuasan 1 sampai 5 bintang (1 = Sangat Kecewa, 5 = Sangat Puas)",
        },
        reviewText: {
          type: "string",
          description: "Teks ulasan, masukan, kritik, atau saran dari pelanggan (opsional)",
        },
      },
      required: ["rating"],
    },
  },
  {
    name: "create_payment_qris_link",
    description:
      "Buat Link Pembayaran Midtrans (Online Payment Link / QRIS) secara otomatis untuk pesanan pelanggan saat closing jualan di chat.",
    parameters: {
      type: "object",
      properties: {
        productName: {
          type: "string",
          description: "Nama barang/layanan yang dipesan",
        },
        amount: {
          type: "number",
          description: "Total harga pembayaran dalam Rupiah murni (misal 50000)",
        },
        qty: {
          type: "number",
          description: "Jumlah/Kuantitas barang (default 1)",
        },
        customerName: {
          type: "string",
          description: "Nama pelanggan (opsional)",
        },
      },
      required: ["productName", "amount"],
    },
  },
];
