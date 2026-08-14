"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import type { ShippingRateItem, ShippingTrackResponse } from "@cs/shared";

const COURIER_OPTIONS = [
  { id: "jnt", name: "J&T Express" },
  { id: "jne", name: "JNE" },
  { id: "sicepat", name: "SiCepat" },
  { id: "shopee", name: "ShopeeExpress" },
  { id: "paxel", name: "Paxel" },
  { id: "pos", name: "Pos Indonesia" },
  { id: "anteraja", name: "Anteraja" },
  { id: "tiki", name: "TIKI" },
];

export default function ShippingPage() {
  const [activeTab, setActiveTab] = useState<"track" | "cost">("track");

  // Track State
  const [courier, setCourier] = useState("jnt");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [trackingData, setTrackingData] = useState<ShippingTrackResponse | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");

  // Cost State
  const [origin, setOrigin] = useState("Surakarta");
  const [destination, setDestination] = useState("Jakarta Selatan");
  const [weightGrams, setWeightGrams] = useState(1000);
  const [ratesData, setRatesData] = useState<ShippingRateItem[]>([]);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState("");

  async function handleTrackWaybill(e: React.FormEvent) {
    e.preventDefault();
    if (!waybillNumber.trim() || trackingLoading) return;
    setTrackingLoading(true);
    setTrackingError("");
    setTrackingData(null);

    try {
      const res = await api<ShippingTrackResponse>(
        `/shipping/track?courier=${courier}&awb=${encodeURIComponent(waybillNumber.trim())}`,
      );
      if (res.ok) {
        setTrackingData(res);
      } else {
        setTrackingError(res.message || "Nomor resi tidak ditemukan");
      }
    } catch (err) {
      setTrackingError(err instanceof Error ? err.message : "Gagal melacak resi");
    } finally {
      setTrackingLoading(false);
    }
  }

  async function handleCalculateCost(e: React.FormEvent) {
    e.preventDefault();
    if (!destination.trim() || costLoading) return;
    setCostLoading(true);
    setCostError("");
    setRatesData([]);

    try {
      const res = await api<{ ok: boolean; rates: ShippingRateItem[]; message?: string }>(
        "/shipping/cost",
        {
          method: "POST",
          body: JSON.stringify({
            origin: origin.trim() || "Surakarta",
            destination: destination.trim(),
            weightGrams: Number(weightGrams) || 1000,
          }),
        },
      );
      if (res.ok && res.rates) {
        setRatesData(res.rates);
      } else {
        setCostError(res.message || "Gagal menghitung ongkir");
      }
    } catch (err) {
      setCostError(err instanceof Error ? err.message : "Gagal menghitung ongkir");
    } finally {
      setCostLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Dashboard Ekspedisi: Cek Resi & Tarif Ongkir"
        description="Lacak posisi paket customer secara real-time dan hitung estimasi ongkir antar kota secara instant."
      />

      {/* Navigation Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("track")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            activeTab === "track"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>🔍 Cek Resi Customer</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cost")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            activeTab === "cost"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Calculator className="h-4 w-4" />
          <span>💰 Cek Biaya Ongkir Multi-Ekspedisi</span>
        </button>
      </div>

      {/* Tab 1: Cek Resi Customer */}
      {activeTab === "track" && (
        <div className="space-y-6">
          <Card className="p-6 border-teal-200 bg-teal-50/20 space-y-4">
            <form onSubmit={handleTrackWaybill} className="grid gap-4 md:grid-cols-12 items-end">
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Ekspedisi / Kurir
                </label>
                <select
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-600 focus:outline-none"
                >
                  {COURIER_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-6">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Resi Customer (AWB) *
                </label>
                <Input
                  value={waybillNumber}
                  onChange={(e) => setWaybillNumber(e.target.value)}
                  placeholder="Masukkan nomor resi (misal: JNT123456789 atau SPX987...)"
                  className="bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={trackingLoading || !waybillNumber.trim()}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2 flex items-center justify-center gap-1.5"
                >
                  {trackingLoading ? (
                    "Melacak..."
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      <span>Lacak</span>
                    </>
                  )}
                </Button>
              </div>
            </form>

            {trackingError ? (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                ⚠️ {trackingError}
              </p>
            ) : null}
          </Card>

          {/* Result Card: Waybill Tracking */}
          {trackingData ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="p-6 border-slate-200 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg text-slate-900">
                        {trackingData.courier} — {trackingData.waybillNumber}
                      </h3>
                      <Badge
                        tone={
                          trackingData.status.toLowerCase().includes("delivered") ||
                          trackingData.status.toLowerCase().includes("terima")
                            ? "success"
                            : "warn"
                        }
                      >
                        {trackingData.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>Asal: {trackingData.origin || "Indonesia"}</span>
                      <span>→</span>
                      <span>Tujuan: {trackingData.destination || "Alamat Customer"}</span>
                      {trackingData.receiverName ? (
                        <span>• Penerima: <strong>{trackingData.receiverName}</strong></span>
                      ) : null}
                    </p>
                  </div>
                </div>

                {/* Timeline History */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4 text-teal-700" />
                    Riwayat Perjalanan Paket Customer
                  </h4>

                  {trackingData.history.length > 0 ? (
                    <div className="relative pl-6 space-y-6 border-l-2 border-teal-200">
                      {trackingData.history.map((h, i) => (
                        <div key={i} className="relative">
                          <span
                            className={`absolute -left-[31px] top-0.5 h-4 w-4 rounded-full border-2 border-white ${
                              i === 0 ? "bg-teal-600 ring-4 ring-teal-100" : "bg-slate-300"
                            }`}
                          />
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-bold text-teal-700 block">
                              {h.date}
                            </span>
                            <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                              {h.description}
                            </p>
                            {h.location ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                                <MapPin className="h-3 w-3" /> {h.location}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      Riwayat detail transit sedang diperbarui oleh sistem kurir.
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          ) : null}
        </div>
      )}

      {/* Tab 2: Cek Biaya Ongkir */}
      {activeTab === "cost" && (
        <div className="space-y-6">
          <Card className="p-6 border-purple-200 bg-purple-50/20 space-y-4">
            <form onSubmit={handleCalculateCost} className="grid gap-4 md:grid-cols-12 items-end">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kota / Kecamatan Asal
                </label>
                <Input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Contoh: Surakarta"
                  className="bg-white"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kota / Kecamatan Tujuan *
                </label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Contoh: Bandung / Jakarta Selatan"
                  className="bg-white"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Berat Barang (Gram)
                </label>
                <Input
                  type="number"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(Number(e.target.value))}
                  placeholder="1000"
                  className="bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={costLoading || !destination.trim()}
                  className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2 flex items-center justify-center gap-1.5"
                >
                  {costLoading ? (
                    "Hitung..."
                  ) : (
                    <>
                      <Calculator className="h-4 w-4" />
                      <span>Cek Ongkir</span>
                    </>
                  )}
                </Button>
              </div>
            </form>

            {costError ? (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                ⚠️ {costError}
              </p>
            ) : null}
          </Card>

          {/* Result Table: Shipping Rates */}
          {ratesData.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Card className="p-6 border-slate-200 space-y-4">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-purple-700" />
                  Daftar Tarif Ongkir ke {destination} ({(weightGrams / 1000).toFixed(1)} kg)
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                        <th className="p-3">Ekspedisi</th>
                        <th className="p-3">Layanan</th>
                        <th className="p-3">Keterangan</th>
                        <th className="p-3">Estimasi Tiba</th>
                        <th className="p-3 text-right">Tarif Ongkir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {ratesData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-extrabold text-slate-900">{r.courier}</td>
                          <td className="p-3">
                            <span className="rounded-lg bg-purple-100 px-2 py-0.5 font-bold text-purple-800 text-[11px]">
                              {r.service}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">{r.description}</td>
                          <td className="p-3 text-slate-600">{r.etd}</td>
                          <td className="p-3 text-right font-extrabold text-teal-700 text-sm">
                            Rp {r.cost.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </div>
      )}
    </div>
  );
}
