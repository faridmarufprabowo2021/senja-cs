import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ingestDocument } from "../src/bot/ingest.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const user = await prisma.user.upsert({
    where: { email: "sari@warungsenja.id" },
    update: {},
    create: {
      email: "sari@warungsenja.id",
      name: "Sari",
      passwordHash,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "budi@warungsenja.id" },
    update: {},
    create: {
      email: "budi@warungsenja.id",
      name: "Budi",
      passwordHash,
    },
  });

  let tenant = await prisma.tenant.findUnique({
    where: { slug: "warung-senja" },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Warung Senja",
        slug: "warung-senja",
        plan: "starter",
        members: {
          create: [
            { userId: user.id, role: "owner" },
            { userId: agent.id, role: "agent" },
          ],
        },
        botSettings: {
          create: {
            enabled: true,
            systemPrompt:
              "Kamu CS WhatsApp Warung Senja. Jawab singkat, ramah, Bahasa Indonesia. Hanya gunakan konteks knowledge. Jika tidak tahu, tawarkan hubungi agent.",
            confidenceThreshold: 0.15,
            handoverKeywords: ["cs", "admin", "human", "agent", "manusia"],
          },
        },
      },
    });
  } else {
    await prisma.botSettings.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        enabled: true,
        systemPrompt:
          "Kamu CS WhatsApp Warung Senja. Jawab singkat, ramah, Bahasa Indonesia.",
        confidenceThreshold: 0.55,
        handoverKeywords: ["cs", "admin", "human", "agent", "manusia"],
      },
      update: {},
    });
  }

  const faqCount = await prisma.knowledgeDocument.count({
    where: { tenantId: tenant.id, title: "FAQ Warung Senja" },
  });

  if (faqCount === 0) {
    const faq = `
# FAQ Warung Senja

## Jam operasional
Warung Senja buka setiap hari pukul 08.00–22.00 WIB, termasuk hari libur nasional.

## Alamat
Jl. Melati No. 12, Bandung. Parkir tersedia di depan toko.

## Menu unggulan
Nasi goreng special, ayam geprek, es teh manis, dan paket hemat keluarga.

## Harga
Nasi goreng mulai Rp18.000. Ayam geprek mulai Rp20.000. Paket hemat Rp45.000 untuk 2 orang.

## Metode pembayaran
Tunai, QRIS, transfer bank, dan e-wallet (GoPay, OVO, Dana).

## Pengiriman / delivery
Melayani delivery radius 5 km. Ongkir mulai Rp8.000. Minimal order Rp40.000.

## Promo
Setiap Jumat: beli 2 ayam geprek gratis es teh. Follow IG @warungsenja untuk update promo.

## Pre-order katering
Bisa pre-order katering H-2. Hubungi agent untuk penawaran.

## Komplain
Jika ada komplain pesanan, sebutkan nomor order atau waktu pesan. Tim kami akan bantu.

## Hubungi manusia
Ketik "cs" atau "admin" untuk dihubungkan ke agent manusia.
`.trim();

    const doc = await prisma.knowledgeDocument.create({
      data: {
        tenantId: tenant.id,
        title: "FAQ Warung Senja",
        sourceType: "md",
        status: "processing",
      },
    });
    await ingestDocument(doc.id, faq);
  }

  tenant = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      vertical: "commerce",
      ...(tenant.payAccount
        ? {}
        : {
            payBank: "BCA",
            payAccount: "1234567890",
            payAccountName: "Sari Warung Senja",
            payNote:
              "QRIS: minta ke kasir / balas chat ini. Transfer atas nama Sari saja.",
          }),
    },
  });

  const productCount = await prisma.product.count({ where: { tenantId: tenant.id } });
  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        { tenantId: tenant.id, name: "Nasi Goreng Special", description: "Nasi goreng spesial dengan telur, ayam, dan kerupuk", price: 25000, stock: 50, unit: "porsi", active: true },
        { tenantId: tenant.id, name: "Ayam Geprek", description: "Ayam goreng geprek sambal level 1-5", price: 22000, stock: 40, unit: "porsi", active: true },
        { tenantId: tenant.id, name: "Es Teh Manis", description: "Es teh manis segar", price: 5000, stock: 100, unit: "gelas", active: true },
        { tenantId: tenant.id, name: "Paket Hemat Keluarga", description: "2 nasi goreng + 2 es teh + 1 ayam geprek", price: 65000, stock: 20, unit: "paket", active: true },
        { tenantId: tenant.id, name: "Mie Goreng", description: "Mie goreng spesial", price: 20000, stock: 40, unit: "porsi", active: true },
        { tenantId: tenant.id, name: "Jus Alpukat", description: "Jus alpukat segar", price: 15000, stock: 30, unit: "gelas", active: true },
      ],
    });
  }

  const seededProducts = await prisma.product.count({ where: { tenantId: tenant.id } });

  console.log("Seeded:");
  console.log("  email: sari@warungsenja.id / demo1234");
  console.log("  tenant:", tenant.slug, tenant.id);
  console.log("  products:", seededProducts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
