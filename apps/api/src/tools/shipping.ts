import { checkShippingRates, trackWaybill } from "../services/shipping.js";

export type ToolResult = {
  ok: boolean;
  text: string;
  data?: unknown;
};

export async function calculateShippingTool(opts: {
  destination: string;
  weightGrams?: number;
  courier?: string;
  origin?: string;
}): Promise<ToolResult> {
  const { destination, weightGrams = 1000, courier, origin } = opts;
  if (!destination?.trim()) {
    return {
      ok: false,
      text: "Mohon sebutkan kota atau kecamatan tujuan pengiriman.",
    };
  }

  const result = await checkShippingRates({
    origin: origin?.trim() || undefined,
    destination: destination.trim(),
    weightGrams,
    courier,
  });

  const weightKg = (weightGrams / 1000).toFixed(1);
  const lines = result.rates.map(
    (r) =>
      `• *${r.courier} (${r.service})*: Rp ${r.cost.toLocaleString("id-ID")} — Estimasi ${r.etd} (${r.description})`,
  );

  return {
    ok: true,
    text: `🚚 *Estimasi Tarif Ongkir ke ${result.destination}* (Berat: ${weightKg} kg):\n\n${lines.join("\n")}\n\n_Pilih ekspedisi favorit Anda saat mengonfirmasi pesanan!_`,
    data: result,
  };
}

export async function trackShipmentTool(opts: {
  waybillNumber: string;
  courier?: string;
}): Promise<ToolResult> {
  const { waybillNumber, courier } = opts;
  if (!waybillNumber?.trim()) {
    return {
      ok: false,
      text: "Mohon berikan nomor resi ekspedisi yang ingin dilacak.",
    };
  }

  const res = await trackWaybill({ waybillNumber, courier });
  if (!res.ok) {
    return {
      ok: false,
      text: `⚠️ Gagal melacak resi ${waybillNumber}: ${res.message || "Nomor resi tidak ditemukan."}`,
    };
  }

  const historyLines = res.history.map(
    (h) => `• [${h.date}] ${h.description}${h.location ? ` (${h.location})` : ""}`,
  );

  return {
    ok: true,
    text: `📦 *Status Pelacakan Resi ${res.courier} - ${res.waybillNumber}*\nStatus: *${res.status}*\n\n*Riwayat Perjalanan Paket*:\n${historyLines.join("\n")}`,
    data: res,
  };
}
