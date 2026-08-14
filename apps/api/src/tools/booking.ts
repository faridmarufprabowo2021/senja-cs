import { prisma } from "../lib/prisma.js";

export type BookingToolResult = {
  ok: boolean;
  text: string;
  data?: unknown;
};

export async function createBookingDraft(
  tenantId: string,
  contactId: string,
  opts: {
    serviceName: string;
    bookingDateStr: string;
    note?: string;
  },
): Promise<BookingToolResult> {
  const { serviceName, bookingDateStr, note = "" } = opts;
  if (!serviceName.trim()) {
    return { ok: false, text: "Nama layanan/jasa tidak boleh kosong." };
  }

  let bookingDate = new Date(bookingDateStr);
  if (isNaN(bookingDate.getTime())) {
    const lower = bookingDateStr.toLowerCase();
    const timeMatch = lower.match(/(\d{1,2})[:.](\d{2})/);
    const hour = timeMatch ? parseInt(timeMatch[1]!, 10) : 10;
    const minute = timeMatch ? parseInt(timeMatch[2]!, 10) : 0;

    const target = new Date();
    if (lower.includes("besok")) {
      target.setDate(target.getDate() + 1);
      target.setHours(hour, minute, 0, 0);
      bookingDate = target;
    } else if (lower.includes("lusa")) {
      target.setDate(target.getDate() + 2);
      target.setHours(hour, minute, 0, 0);
      bookingDate = target;
    }
  }

  if (isNaN(bookingDate.getTime())) {
    return {
      ok: false,
      text: "Format tanggal & waktu booking tidak valid. Mohon sebutkan tanggal & jam lengkap (contoh: Besok jam 14:00 atau 2026-08-10 14:00).",
    };
  }

  // Ensure booking date is not in the past (allow 10 min tolerance)
  if (bookingDate.getTime() < Date.now() - 10 * 60 * 1000) {
    return {
      ok: false,
      text: "Jadwal booking tidak bisa memilih waktu yang sudah lewat di masa lalu. Mohon pilih waktu di masa mendatang.",
    };
  }

  const booking = await prisma.booking.create({
    data: {
      tenantId,
      contactId,
      serviceName: serviceName.trim(),
      bookingDate,
      note,
      status: "pending",
    },
    include: {
      contact: true,
      tenant: true,
    },
  });

  const formattedDate = bookingDate.toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return {
    ok: true,
    text: `📅 *Reservasi/Booking Berhasil Dibuat*\n\nLayanan: *${booking.serviceName}*\nJadwal: ${formattedDate}\nPelanggan: ${booking.contact.name} (${booking.contact.phone})\nStatus: Pending Konfirmasi Admin\n\n_Ketik *cs* bila butuh bantuan atau penyesuaian jadwal._`,
    data: booking,
  };
}

export async function listBookings(
  tenantId: string,
  contactId: string,
): Promise<BookingToolResult> {
  const bookings = await prisma.booking.findMany({
    where: { tenantId, contactId },
    orderBy: { bookingDate: "desc" },
    take: 5,
  });

  if (!bookings.length) {
    return { ok: true, text: "Belum ada riwayat booking/reservasi untuk Anda." };
  }

  const lines = bookings.map(
    (b) =>
      `• ${b.serviceName} — ${new Date(b.bookingDate).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} [${b.status}]`,
  );

  return {
    ok: true,
    text: `Daftar Reservasi Anda:\n${lines.join("\n")}`,
    data: bookings,
  };
}

export async function rescheduleBooking(
  tenantId: string,
  contactId: string,
  opts: {
    bookingId?: string;
    newBookingDateStr: string;
    reason?: string;
  },
): Promise<BookingToolResult> {
  const { bookingId, newBookingDateStr, reason } = opts;

  let targetBooking = null;

  if (bookingId) {
    targetBooking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId, contactId },
      include: { contact: true },
    });
  }

  if (!targetBooking) {
    targetBooking = await prisma.booking.findFirst({
      where: {
        tenantId,
        contactId,
        status: { in: ["pending", "confirmed"] },
      },
      orderBy: { bookingDate: "desc" },
      include: { contact: true },
    });
  }

  if (!targetBooking) {
    return {
      ok: false,
      text: "Anda belum memiliki jadwal reservasi aktif (pending/confirmed) untuk diubah.",
    };
  }

  let newBookingDate = new Date(newBookingDateStr);

  if (isNaN(newBookingDate.getTime())) {
    const lower = newBookingDateStr.toLowerCase();
    const timeMatch = lower.match(/(\d{1,2})[:.](\d{2})/);
    const hour = timeMatch ? parseInt(timeMatch[1]!, 10) : 10;
    const minute = timeMatch ? parseInt(timeMatch[2]!, 10) : 0;

    const target = new Date();
    if (lower.includes("besok")) {
      target.setDate(target.getDate() + 1);
      target.setHours(hour, minute, 0, 0);
      newBookingDate = target;
    } else if (lower.includes("lusa")) {
      target.setDate(target.getDate() + 2);
      target.setHours(hour, minute, 0, 0);
      newBookingDate = target;
    }
  }

  if (isNaN(newBookingDate.getTime())) {
    return {
      ok: false,
      text: "Format tanggal & waktu jadwal baru tidak valid. Mohon sebutkan tanggal & jam lengkap (contoh: 2026-08-17 14:00).",
    };
  }

  if (newBookingDate.getTime() < Date.now() - 10 * 60 * 1000) {
    return {
      ok: false,
      text: "Jadwal reschedule tidak bisa memilih waktu yang sudah lewat di masa lalu. Mohon pilih waktu di masa mendatang.",
    };
  }

  // Check for conflicts
  const { checkBookingConflicts } = await import("../lib/booking-conflicts.js");
  const conflict = await checkBookingConflicts(tenantId, newBookingDate, targetBooking.id, 2);
  if (conflict.hasConflict) {
    return {
      ok: false,
      text: `⚠️ Maaf, jadwal pada ${newBookingDate.toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })} sudah terisi reservasi lain. Mohon pilih jam atau hari lain yang masih kosong.`,
    };
  }

  const noteAddition = reason ? ` [Reschedule: ${reason}]` : " [Reschedule via AI Bot]";
  const updated = await prisma.booking.update({
    where: { id: targetBooking.id },
    data: {
      bookingDate: newBookingDate,
      status: "confirmed",
      note: `${targetBooking.note || ""}${noteAddition}`.trim(),
    },
    include: { contact: true },
  });

  const formattedDate = newBookingDate.toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return {
    ok: true,
    text: `✅ *Reschedule Jadwal Reservasi Berhasil!*\n\nLayanan: *${updated.serviceName}*\nJadwal Baru: *${formattedDate}*\nPelanggan: ${updated.contact.name} (${updated.contact.phone})\nStatus: Terkonfirmasi ✨\n\n_Pengingat otomatis WhatsApp H-1 & 2 Jam sebelum waktu tindakan akan otomatis dikirim ke nomor Anda._`,
    data: updated,
  };
}
