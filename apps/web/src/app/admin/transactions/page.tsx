"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

type AdminTransactionItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  snapRedirectUrl: string | null;
  createdAt: string;
  paidAt: string | null;
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AdminTransactionItem[]>("/admin/transactions")
      .then(setTransactions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-sm text-[var(--color-muted)]">Memuat log transaksi SaaS Midtrans…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log Transaksi Langganan Midtrans"
        description="Riwayat seluruh tagihan langganan SaaS paket Pro & Enterprise yang dibayar via Midtrans."
      />

      {/* Transactions Table Card */}
      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)] font-medium">
                <th className="pb-2.5">ID Transaksi</th>
                <th className="pb-2.5">Toko UMKM</th>
                <th className="pb-2.5">Paket</th>
                <th className="pb-2.5">Nominal (Rp)</th>
                <th className="pb-2.5">Status Midtrans</th>
                <th className="pb-2.5">Tanggal Buat</th>
                <th className="pb-2.5 text-right">Tautan Midtrans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[var(--color-paper-2)]/50 transition">
                  <td className="py-3 font-mono font-medium text-[var(--color-ink)]">#{tx.id.slice(-8)}</td>
                  <td className="py-3">
                    <div className="font-semibold text-[var(--color-ink)]">{tx.tenantName}</div>
                    <div className="text-[11px] text-[var(--color-muted)] font-mono">/{tx.tenantSlug}</div>
                  </td>
                  <td className="py-3 uppercase font-semibold text-[var(--color-accent)]">{tx.plan}</td>
                  <td className="py-3 font-mono font-semibold text-[var(--color-ink)]">
                    Rp{tx.amount.toLocaleString("id-ID")}
                  </td>
                  <td className="py-3">
                    <Badge tone={tx.status === "paid" ? "success" : tx.status === "pending" ? "warn" : "danger"}>
                      {tx.status === "paid" ? "Lunas" : tx.status === "pending" ? "Pending" : "Gagal"}
                    </Badge>
                  </td>
                  <td className="py-3 text-[var(--color-muted)]">
                    {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 text-right">
                    {tx.snapRedirectUrl ? (
                      <a
                        href={tx.snapRedirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] hover:underline"
                      >
                        Snap Link <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!transactions.length ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--color-muted)]">
                    Belum ada riwayat transaksi langganan Midtrans.
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
