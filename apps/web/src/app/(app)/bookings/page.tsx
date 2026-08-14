"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutList,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import type { Booking, BookingStatus } from "@cs/shared";
import { BOOKING_STATUS_LABEL } from "@cs/shared";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api, getSession } from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";
import { isManager } from "@/lib/roles";

const FILTERS: { id: "all" | BookingStatus; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Menunggu" },
  { id: "confirmed", label: "Dikonfirmasi" },
  { id: "completed", label: "Selesai" },
  { id: "cancelled", label: "Batal" },
];

function statusTone(s: BookingStatus) {
  if (s === "pending") return "warn" as const;
  if (s === "confirmed") return "human" as const;
  if (s === "completed") return "success" as const;
  if (s === "cancelled") return "danger" as const;
  return "default" as const;
}

const NEXT: Partial<Record<BookingStatus, BookingStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

/** ISO string → value untuk input datetime-local (waktu lokal). */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingsPage() {
  const manager = isManager();
  const [items, setItems] = useState<Booking[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [calendarMode, setCalendarMode] = useState<"week" | "month">("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");

  // Create Manual Booking Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newBookingDate, setNewBookingDate] = useState("");
  const [newNote, setNewNote] = useState("");

  // Define flash FIRST since callbacks depend on it
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Define load BEFORE callbacks
  const load = useCallback(async () => {
    try {
      const qs =
        filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const list = await api<Booking[]>(`/bookings${qs}`);
      setItems(list);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat booking");
    }
  }, [filter]);

  // Real-time listener for updates/deletions from server (called at top level!)
  const handleUpdate = useCallback(() => {
    load();
    flash("Booking diperbarui secara real-time");
  }, [load, flash]);

  const handleDelete = useCallback(() => {
    load();
    flash("Booking dihapus");
  }, [load, flash]);

  if (manager) {
    useRealtime((event, data) => {
      if (event === "booking.updated") handleUpdate();
      if (event === "booking.deleted") handleDelete();
    });
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: BookingStatus) {
    setBusy(true);
    setError("");
    try {
      await api(`/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      flash(`Booking ${BOOKING_STATUS_LABEL[status].toLowerCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal update status");
    } finally {
      setBusy(false);
    }
  }

  async function saveReschedule(id: string) {
    if (!editDate) return;
    setBusy(true);
    setError("");
    try {
      const res = await api(`/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ bookingDate: new Date(editDate).toISOString() }),
      }) as any;

      // Check if response is a conflict (409)
      if (res.status === 409) {
        const data = await res.json();
        const conflictHTML = data.conflicts?.map((c: any) =>
          `<li>${c.message}</li>`
        ).join("") || "";

        setError(`<strong>⚠️ Tabrakan Jadwal Terdeteksi:</strong><ul style="margin: 8px 0;">${conflictHTML}</ul>`);
      } else {
        await load();
        setEditingId(null);
        flash("Jadwal booking diubah");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal ubah jadwal");
    } finally {
      setBusy(false);
    }
  }

  async function handleExportCsv() {
    setBusy(true);
    setError("");
    try {
      // window.open tidak membawa header Authorization → 401.
      // Gunakan fetch manual dengan token dari session.
      const session = getSession();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const res = await fetch(`${apiUrl}/bookings/export-csv`, {
        headers: {
          ...(session?.token
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
          ...(session?.tenantId
            ? { "X-Tenant-Id": session.tenantId }
            : {}),
        },
      });
      if (!res.ok) {
        throw new Error(`Gagal export CSV (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "laporan-booking.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      flash("CSV berhasil di-export");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export CSV");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadTemplate() {
    const csvContent = "Layanan,Jadwal Booking,Nama Pelanggan,Nomor WA,Catatan,Status\n" +
      "Potong Rambut,Budi Santoso,+62812345678,2026-08-15T14:00:00Z,Gerigi,Pending\n" +
      "Facial SPA,Siti Aminah,+62812345679,2026-08-16T10:00:00Z,,Confirmed";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_booking.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(file: File) {
    // Validasi: hanya terima file CSV — error sebelumnya terjadi karena
    // user mencoba upload file gambar (image.png)
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError(
        `File "${file.name}" ditolak. Hanya file CSV (.csv) yang bisa di-import. Gunakan tombol "Download Template" untuk format yang benar.`,
      );
      return;
    }

    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      // api() sudah otomatis attach token + tenant header, dan parse JSON.
      // Non-2xx akan throw dengan pesan error dari body.
      const result = await api<{
        ok: boolean;
        results: {
          success: number;
          failed: number;
          errors: { row: number; reason: string }[];
        };
      }>("/bookings/import", {
        method: "POST",
        body: formData,
      });

      flash(
        `${result.results.success} berhasil, ${result.results.failed} gagal`,
      );

      if (result.results.errors.length > 0) {
        setError(
          `Baris error (${result.results.errors.length}):\n` +
            result.results.errors
              .slice(0, 10)
              .map((e) => `Baris ${e.row}: ${e.reason}`)
              .join("\n"),
        );
      }

      await load();
    } catch (err: any) {
      setError(err.message ?? "Gagal upload file");
    } finally {
      setBusy(false);
    }
  }

  // --- Calendar Date Calculations ---
  const currentDayOfWeek = currentDate.getDay(); // 0 is Sun, 1 is Mon
  const distToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(currentDate);
  monday.setDate(currentDate.getDate() + distToMon);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  // Calculate Days in Month for Monthly View
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthGridDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - startDayOfWeek + i);
    return d;
  });

  const timeSlots = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

  function navigatePrev() {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (calendarMode === "week") {
        next.setDate(prev.getDate() - 7);
      } else {
        next.setMonth(prev.getMonth() - 1);
      }
      return next;
    });
  }

  function navigateNext() {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (calendarMode === "week") {
        next.setDate(prev.getDate() + 7);
      } else {
        next.setMonth(prev.getMonth() + 1);
      }
      return next;
    });
  }

  function resetToday() {
    setCurrentDate(new Date());
  }

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  async function handleManualCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newServiceName || !newContactName || !newContactPhone || !newBookingDate) return;
    setBusy(true);
    setError("");
    try {
      const res = (await api("/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceName: newServiceName,
          contactName: newContactName,
          contactPhone: newContactPhone,
          bookingDate: new Date(newBookingDate).toISOString(),
          note: newNote,
          status: "confirmed",
        }),
      })) as any;

      if (res.status === 409) {
        const data = await res.json();
        const conflictHTML =
          data.conflicts
            ?.map((c: any) => `<li>${c.message}</li>`)
            .join("") || "";
        setError(
          `<strong>⚠️ Tabrakan Jadwal Terdeteksi:</strong><ul style="margin: 8px 0;">${conflictHTML}</ul>`,
        );
      } else {
        await load();
        setShowCreateModal(false);
        setNewServiceName("");
        setNewContactName("");
        setNewContactPhone("");
        setNewBookingDate("");
        setNewNote("");
        flash("✅ Booking manual berhasil dibuat!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat booking");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Booking"
        description="Reservasi dari WA bot atau input manual CS — konfirmasi, reschedule, atau batalkan jadwal pelanggan."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-white font-bold"
              onClick={() => setShowCreateModal(true)}
            >
              + Buat Booking Manual
            </Button>
            <Button variant="secondary" onClick={handleExportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <div className="relative inline-block text-left">
              <Button
                variant="secondary"
                onClick={() => document.getElementById('csv-menu')?.click()}
              >
                <BookOpen className="h-4 w-4" />
                Import CSV
              </Button>
              {/* Dropdown menu */}
              <div id="csv-menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--color-line)] bg-white p-1 shadow-lg hidden group-hover:block group-focus-within:block">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="block w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] transition"
                >
                  📥 Download Template
                </button>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex rounded-xl border border-[var(--color-line)] bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === "list"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === "calendar"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Kalender
              </button>
            </div>
          </div>
        }
      />

      {toast ? (
        <p className="mb-4 rounded-xl bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent)]">
          {toast}
        </p>
      ) : null}

      {error ? (
        <p
          className="mb-4 rounded-xl bg-[var(--color-sunset-soft)] px-3 py-2 text-sm text-[var(--color-sunset)]"
          dangerouslySetInnerHTML={{ __html: error }}
        />
      ) : null}

      {/* Filter Status Bar + Calendar Nav */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.id
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-paper-2)] text-[var(--color-muted)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Calendar Nav Controls */}
        {viewMode === "calendar" ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switcher: Month vs Week */}
            <div className="flex rounded-xl border border-[var(--color-line)] bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setCalendarMode("month")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  calendarMode === "month"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]"
                }`}
              >
                Bulan
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode("week")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  calendarMode === "week"
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-paper-2)]"
                }`}
              >
                Minggu
              </button>
            </div>

            {/* Nav Arrows */}
            <div className="flex items-center gap-1 rounded-xl border border-[var(--color-line)] bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={navigatePrev}
                className="grid h-7 w-7 place-items-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
                title="Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetToday}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
                title="Kembali ke Hari Ini"
              >
                <RotateCcw className="h-3 w-3" />
                Hari Ini
              </button>
              <button
                type="button"
                onClick={navigateNext}
                className="grid h-7 w-7 place-items-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
                title="Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Current Month Title Display */}
            <div className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-ink)] shadow-sm">
              {currentDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </div>
          </div>
        ) : null}
      </div>

      {viewMode === "list" ? (
        <div className="space-y-3">
          {items.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{b.serviceName}</span>
                    <Badge tone={statusTone(b.status)}>
                      {BOOKING_STATUS_LABEL[b.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {b.contactName} · {b.contactPhone}
                  </p>
                </div>
                <div className="text-right text-sm font-semibold text-[var(--color-accent)]">
                  {formatDate(b.bookingDate)}
                </div>
              </div>
              {b.note ? (
                <p className="mt-1 text-xs text-[var(--color-faint)]">
                  Catatan: {b.note}
                </p>
              ) : null}

              {editingId === b.id ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <input
                    type="datetime-local"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={busy || !editDate}
                    onClick={() => void saveReschedule(b.id)}
                  >
                    Simpan jadwal
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                  >
                    Batal
                  </Button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {b.status !== "cancelled" && b.status !== "completed" && editingId !== b.id ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(b.id);
                      setEditDate(toLocalInput(b.bookingDate));
                    }}
                  >
                    Reschedule
                  </Button>
                ) : null}
                {(NEXT[b.status] ?? []).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "cancelled" ? "danger" : "secondary"}
                    disabled={busy}
                    onClick={() => void setStatus(b.id, s)}
                  >
                    → {BOOKING_STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
          {!items.length ? (
            <p className="text-sm text-[var(--color-muted)]">
              Belum ada booking. Pelanggan bisa ketik di WA: &quot;booking facial besok jam 2 siang&quot;.
            </p>
          ) : null}
        </div>
      ) : calendarMode === "month" ? (
        /* Monthly Calendar View */
        <Card className="p-4">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 border-b border-[var(--color-line)] pb-2 text-center text-xs font-semibold text-[var(--color-muted)]">
            <div>Sen</div>
            <div>Sel</div>
            <div>Rab</div>
            <div>Kam</div>
            <div>Jum</div>
            <div>Sab</div>
            <div>Min</div>
          </div>

          {/* Monthly Day Grid */}
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {monthGridDays.map((day, idx) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const dayBookings = items.filter((b) => {
                const bd = new Date(b.bookingDate);
                return (
                  bd.getFullYear() === day.getFullYear() &&
                  bd.getMonth() === day.getMonth() &&
                  bd.getDate() === day.getDate()
                );
              });

              return (
                <div
                  key={`${day.toISOString()}-${idx}`}
                  className={`min-h-[110px] rounded-xl border p-2 transition flex flex-col justify-between ${
                    isToday(day)
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                      : isCurrentMonth
                        ? "border-[var(--color-line)] bg-white hover:border-[var(--color-muted)]"
                        : "border-transparent bg-[var(--color-paper-2)] opacity-40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday(day)
                          ? "grid h-6 w-6 place-items-center rounded-full bg-[var(--color-accent)] text-white"
                          : isCurrentMonth
                            ? "text-[var(--color-ink)]"
                            : "text-[var(--color-faint)]"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayBookings.length > 0 ? (
                      <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {dayBookings.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 space-y-1 overflow-y-auto max-h-[70px]">
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-md border border-[var(--color-line)] bg-white p-1 text-[11px] shadow-xs"
                        title={`${b.serviceName} - ${b.contactName} (${new Date(b.bookingDate).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })})`}
                      >
                        <div className="font-semibold truncate text-[var(--color-ink)]">
                          {b.serviceName}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
                          <span className="truncate">{b.contactName}</span>
                          <span className="font-mono text-[9px]">
                            {new Date(b.bookingDate).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        /* Weekly Calendar View */
        <Card className="overflow-x-auto p-4">
          <div className="min-w-[800px]">
            {/* Days Header */}
            <div className="grid grid-cols-8 border-b border-[var(--color-line)] pb-3 text-center">
              <div className="text-xs font-semibold text-[var(--color-muted)]">Jam</div>
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="text-center">
                  <div className="text-xs font-medium">
                    {day.toLocaleDateString("id-ID", { weekday: "short" })}
                  </div>
                  <div className={`text-sm font-bold ${isToday(day) ? "text-[var(--color-accent)] underline" : "text-[var(--color-ink)]"}`}>
                    {day.getDate()} {day.toLocaleDateString("id-ID", { month: "short" })}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Slot Rows */}
            {timeSlots.map((slot) => {
              const slotHour = parseInt(slot.split(":")[0], 10);
              return (
                <div
                  key={slot}
                  className="grid grid-cols-8 border-b border-[var(--color-line)] min-h-[90px] py-2"
                >
                  <div className="text-xs font-semibold text-[var(--color-muted)] pt-1">
                    {slot}
                  </div>
                  {weekDays.map((day) => {
                    // Match bookings on this date & hour slot (range hour to hour+2)
                    const dayBookings = items.filter((b) => {
                      const bd = new Date(b.bookingDate);
                      const sameDate =
                        bd.getFullYear() === day.getFullYear() &&
                        bd.getMonth() === day.getMonth() &&
                        bd.getDate() === day.getDate();
                      const sameHour = bd.getHours() >= slotHour && bd.getHours() < slotHour + 2;
                      return sameDate && sameHour;
                    });

                    return (
                      <div
                        key={day.toISOString()}
                        className="border-l border-[var(--color-line)] p-1 space-y-1.5"
                      >
                        {dayBookings.map((b) => (
                          <div
                            key={b.id}
                            className="rounded-lg border border-[var(--color-line)] bg-white p-2 text-xs shadow-sm hover:border-[var(--color-accent)] transition"
                          >
                            <div className="font-semibold truncate">{b.serviceName}</div>
                            <div className="text-[10px] text-[var(--color-muted)] truncate">
                              {b.contactName}
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <Badge tone={statusTone(b.status)}>
                                {BOOKING_STATUS_LABEL[b.status]}
                              </Badge>
                              {(NEXT[b.status] ?? []).slice(0, 1).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void setStatus(b.id, s)}
                                  className="text-[10px] text-[var(--color-accent)] underline font-medium"
                                >
                                  → {BOOKING_STATUS_LABEL[s]}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Modal Input Booking Manual */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-6 bg-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-[var(--color-ink)]">
                🗓️ Buat Booking / Reservasi Manual
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nama Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nomor WhatsApp Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 081234567890"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nama Layanan / Servis *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Servis AC / Potong Rambut / Facial SPA"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Jadwal Tanggal &amp; Jam Booking *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newBookingDate}
                  onChange={(e) => setNewBookingDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan khusus, lokasi, atau keluhan pelanggan..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={busy}
                  className="bg-[var(--color-accent)] text-white font-bold"
                >
                  {busy ? "Menyimpan..." : "Simpan Booking"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
