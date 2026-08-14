"use client";

import { useEffect, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

type WaMonitorItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  engineType: string;
  status: string;
  phone: string | null;
  updatedAt: string;
};

export default function AdminWaMonitorPage() {
  const [sessions, setSessions] = useState<WaMonitorItem[]>([]);
  const [loading, setLoading] = useState(true);

  function loadSessions() {
    setLoading(true);
    api<WaMonitorItem[]>("/admin/wa-monitor")
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring Server Driver WhatsApp"
        description="Status real-time koneksi Baileys & Open-WA driver socket di server API backend."
        action={
          <Button variant="secondary" onClick={loadSessions}>
            <RefreshCw className="h-4 w-4" /> Refresh Status
          </Button>
        }
      />

      {/* WA Sessions Table Card */}
      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)] font-medium">
                <th className="pb-2.5">Toko UMKM</th>
                <th className="pb-2.5">Engine WA</th>
                <th className="pb-2.5">Nomor Terhubung</th>
                <th className="pb-2.5">Status Sesi</th>
                <th className="pb-2.5 text-right">Terakhir Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--color-paper-2)]/50 transition">
                  <td className="py-3 font-semibold text-[var(--color-ink)]">{s.tenantName}</td>
                  <td className="py-3 font-mono uppercase text-[var(--color-muted)]">{s.engineType}</td>
                  <td className="py-3 font-mono font-medium text-[var(--color-accent)]">
                    {s.phone || "—"}
                  </td>
                  <td className="py-3">
                    <Badge tone={s.status === "connected" ? "success" : s.status === "qr" ? "warn" : "danger"}>
                      <Radio className="h-3 w-3 mr-1" />
                      {s.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-right text-[var(--color-muted)]">
                    {new Date(s.updatedAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
              {!sessions.length && !loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[var(--color-muted)]">
                    Belum ada sesi WhatsApp yang dibuat di server.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
