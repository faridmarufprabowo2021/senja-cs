import type { OrderStatus } from "@prisma/client";

export type InvoiceOrder = {
  id: string;
  status: OrderStatus;
  total: number;
  note: string;
  createdAt: Date;
  contact: { name: string };
  items: { qty: number; price: number; product: { name: string } }[];
  tenant: {
    name: string;
    payBank: string;
    payAccount: string;
    payAccountName: string;
    payNote: string;
  };
};

export function formatRp(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export function orderRef(id: string) {
  return id.slice(-6).toUpperCase();
}

export function statusLabelId(status: OrderStatus): string {
  switch (status) {
    case "draft":
      return "Menunggu konfirmasi";
    case "confirmed":
      return "Menunggu pembayaran";
    case "paid":
      return "Lunas";
    case "done":
      return "Selesai";
    case "cancelled":
      return "Dibatalkan";
    default:
      return status;
  }
}

export function formatPaymentBlock(t: {
  payBank: string;
  payAccount: string;
  payAccountName: string;
  payNote: string;
}): string | null {
  const lines: string[] = [];
  if (t.payBank || t.payAccount) {
    const bank = [t.payBank, t.payAccount].filter(Boolean).join(" ");
    lines.push(bank);
  }
  if (t.payAccountName) lines.push(`a.n. ${t.payAccountName}`);
  if (t.payNote.trim()) lines.push(t.payNote.trim());
  if (!lines.length) return null;
  return lines.join("\n");
}

/** Invoice / tagihan (belum lunas) — B2 + B1 */
export function formatInvoiceText(order: InvoiceOrder): string {
  const ref = orderRef(order.id);
  const when = order.createdAt.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const lines = order.items.map(
    (i) =>
      `• ${i.qty}× ${i.product.name} — ${formatRp(i.price * i.qty)}`,
  );
  const pay = formatPaymentBlock(order.tenant);
  const parts = [
    `🧾 *Invoice ${order.tenant.name}*`,
    `No: ${ref} · ${when}`,
    "",
    `Halo *${order.contact.name}*,`,
    "",
    "*Rincian pesanan*",
    ...lines,
    "",
    `*Total*  *${formatRp(order.total)}*`,
    `Status: *${statusLabelId(order.status)}*`,
  ];
  if (order.note?.trim()) {
    parts.push(`Catatan: ${order.note.trim()}`);
  }
  if (pay && order.status !== "paid" && order.status !== "done") {
    parts.push("", "— Cara bayar —", pay, "", "Setelah transfer, balas chat ini dengan *bukti bayar*.");
  } else if (!pay && order.status !== "paid" && order.status !== "done") {
    parts.push(
      "",
      "_Cara bayar belum diatur toko. Minta admin isi di Pengaturan._",
    );
  }
  parts.push("", "Terima kasih 🙏");
  return parts.join("\n");
}

/** Nota setelah lunas — siap untuk B3 / status paid */
export function formatPaidReceiptText(order: InvoiceOrder): string {
  const ref = orderRef(order.id);
  const lines = order.items.map(
    (i) => `• ${i.qty}× ${i.product.name}`,
  );
  const parts = [
    `✅ *Pembayaran diterima*`,
    `*${order.tenant.name}* · No: ${ref}`,
    "",
    `Halo *${order.contact.name}*,`,
    "",
    `Terima kasih, pembayaran *${formatRp(order.total)}* sudah kami terima.`,
    "",
    "*Pesanan Anda*",
    ...lines,
    "",
    `*Total*  *${formatRp(order.total)}* · *LUNAS*`,
    `Status: *${order.status === "done" ? "Selesai" : "Sedang disiapkan"}*`,
  ];

  if (order.tenant.payNote?.trim()) {
    parts.push("", `📌 Catatan: ${order.tenant.payNote.trim()}`);
  }

  parts.push(
    "",
    "Ada pertanyaan? Balas chat ini saja.",
    "Terima kasih 🙏",
  );
  return parts.join("\n");
}

export function formatPaymentInstructionsOnly(t: {
  name: string;
  payBank: string;
  payAccount: string;
  payAccountName: string;
  payNote: string;
}): string {
  const pay = formatPaymentBlock(t);
  if (!pay) {
    return `Cara bayar *${t.name}* belum diatur. Minta admin isi rekening/QRIS di Pengaturan.`;
  }
  return `*Cara bayar ${t.name}*\n${pay}\n\nSetelah transfer, kirim *bukti bayar* di chat ini.`;
}
