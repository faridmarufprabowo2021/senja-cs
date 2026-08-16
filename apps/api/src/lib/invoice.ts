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
    invoiceHeader?: string;
    invoiceFooter?: string;
    receiptHeader?: string;
    receiptFooter?: string;
    invoiceCustomTemplate?: string;
    receiptCustomTemplate?: string;
    useCustomInvoiceTemplate?: boolean;
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
  if (t.payNote?.trim()) lines.push(t.payNote.trim());
  if (!lines.length) return null;
  return lines.join("\n");
}

export function compileTemplateVariables(
  template: string,
  vars: {
    storeName: string;
    customerName: string;
    orderRef: string;
    itemsList: string;
    total: string;
    status: string;
    paymentInfo: string;
    date: string;
  },
): string {
  if (!template) return "";
  return template
    .replace(/\{store_name\}/g, vars.storeName || "Toko")
    .replace(/\{customer_name\}/g, vars.customerName || "Pelanggan")
    .replace(/\{order_ref\}/g, vars.orderRef || "#ORD")
    .replace(/\{items\}/g, vars.itemsList || "")
    .replace(/\{total\}/g, vars.total || "Rp0")
    .replace(/\{status\}/g, vars.status || "Baru")
    .replace(/\{payment_info\}/g, vars.paymentInfo || "")
    .replace(/\{date\}/g, vars.date || "");
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
  const itemsLines = order.items.map(
    (i) => `• ${i.qty}× ${i.product.name} — ${formatRp(i.price * i.qty)}`,
  ).join("\n");

  const pay = formatPaymentBlock(order.tenant);
  const payBlock = pay
    ? `— Cara bayar —\n${pay}\n\nSetelah transfer, balas chat ini dengan *bukti bayar*.`
    : "_Cara bayar belum diatur toko. Minta admin isi di Pengaturan._";

  // Check if custom template enabled
  if (order.tenant.useCustomInvoiceTemplate && order.tenant.invoiceCustomTemplate?.trim()) {
    return compileTemplateVariables(order.tenant.invoiceCustomTemplate, {
      storeName: order.tenant.name,
      customerName: order.contact.name,
      orderRef: ref,
      itemsList: itemsLines,
      total: formatRp(order.total),
      status: statusLabelId(order.status),
      paymentInfo: payBlock,
      date: when,
    });
  }

  // Header & Footer custom override if present
  const header = order.tenant.invoiceHeader?.trim() || `🧾 *Invoice ${order.tenant.name}*`;
  const footer = order.tenant.invoiceFooter?.trim() || "Terima kasih 🙏";

  const parts = [
    header,
    `No: ${ref} · ${when}`,
    "",
    `Halo *${order.contact.name}*,`,
    "",
    "*Rincian pesanan*",
    itemsLines,
    "",
    `*Total*  *${formatRp(order.total)}*`,
    `Status: *${statusLabelId(order.status)}*`,
  ];
  if (order.note?.trim()) {
    parts.push(`Catatan: ${order.note.trim()}`);
  }
  if (order.status !== "paid" && order.status !== "done") {
    parts.push("", payBlock);
  }
  parts.push("", footer);
  return parts.join("\n");
}

/** Nota setelah lunas — siap untuk B3 / status paid */
export function formatPaidReceiptText(order: InvoiceOrder): string {
  const ref = orderRef(order.id);
  const when = order.createdAt.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const itemsLines = order.items.map(
    (i) => `• ${i.qty}× ${i.product.name}`,
  ).join("\n");

  if (order.tenant.useCustomInvoiceTemplate && order.tenant.receiptCustomTemplate?.trim()) {
    return compileTemplateVariables(order.tenant.receiptCustomTemplate, {
      storeName: order.tenant.name,
      customerName: order.contact.name,
      orderRef: ref,
      itemsList: itemsLines,
      total: formatRp(order.total),
      status: order.status === "done" ? "Selesai" : "Sedang disiapkan",
      paymentInfo: "LUNAS",
      date: when,
    });
  }

  const header = order.tenant.receiptHeader?.trim() || `✅ *Pembayaran diterima*\n*${order.tenant.name}* · No: ${ref}`;
  const footer = order.tenant.receiptFooter?.trim() || "Ada pertanyaan? Balas chat ini saja.\nTerima kasih 🙏";

  const parts = [
    header,
    "",
    `Halo *${order.contact.name}*,`,
    "",
    `Terima kasih, pembayaran *${formatRp(order.total)}* sudah kami terima.`,
    "",
    "*Pesanan Anda*",
    itemsLines,
    "",
    `*Total*  *${formatRp(order.total)}* · *LUNAS*`,
    `Status: *${order.status === "done" ? "Selesai" : "Sedang disiapkan"}*`,
  ];

  if (order.tenant.payNote?.trim()) {
    parts.push("", `📌 Catatan: ${order.tenant.payNote.trim()}`);
  }

  parts.push("", footer);
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
