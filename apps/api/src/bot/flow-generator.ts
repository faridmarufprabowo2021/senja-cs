import { chatComplete } from "../lib/llm.js";

export type GeneratedFlowStructure = {
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
};

export async function generateFlowFromPrompt(
  userPrompt: string,
  presetType?: string,
): Promise<GeneratedFlowStructure> {
  const promptLower = (userPrompt || "").toLowerCase();

  const systemInstruction = `Anda adalah AI Specialist Automation Architect untuk WhatsApp Customer Service UMKM.
Tugas Anda adalah merancang diagram alur percakapan visual (Flow Diagram) dalam bentuk JSON terstruktur berdasarkan permintaan pengguna.

BEBAS GUNAKAN NODE BERIKUT UNTUK ALUR YANG LENGKAP & RELEVAN:
1. "triggerNode": pemicu pesan WA (data: { label, triggerType: "all_messages"|"keyword", keywords?: string })
2. "mediaNode": kirim foto/katalog PDF/video (data: { label, mediaType: "image"|"document"|"video", caption?: string })
3. "aiNode": pencarian AI RAG & rekomendasi foto katalog otomatis (data: { label, systemPrompt?: string })
4. "conditionNode": percabangan logika Ya/Tidak (data: { label, yesKeywords?: string })
5. "actionNode": buat transaksi (data: { label, actionType: "create_invoice_b1"|"send_qris_b2"|"auto_nota_b3" })
6. "handoverNode": alihkan ke CS Manusia (data: { label, note?: string })
7. "webhookNode": kirim data ke Google Sheets / ERP (data: { label, webhookUrl?: string })

ATURAN LAYOUT KOORDINAT X dan Y:
- Node pertama (trigger): { x: 250, y: 50 }
- Node kedua: { x: 250, y: 190 }
- Jika ada conditionNode (y: 330), cabang "yes" ditaruh di x: 100, y: 470 (sourceHandle: "yes") dan cabang "no" ditaruh di x: 420, y: 470 (sourceHandle: "no").
- Node turunan yes/no: turunkan y sebesar +140.

FORMAT OUTPUT WAJIB PURE JSON DENGAN KEY: "name", "description", "nodes", "edges".`;

  let promptInstruction = userPrompt;
  if (presetType === "toko_qris") {
    promptInstruction = "Buatkan alur toko online & QRIS B2: kata kunci promo/harga, kirim foto menu, percabangan setuju beli (Ya: buat QRIS B2, Tidak: konsultasi AI RAG), lalu alih ke CS manusia.";
  } else if (presetType === "booking_klinik") {
    promptInstruction = "Buatkan alur booking klinik/salon: kata kunci booking/jadwal, kirim pricelist PDF, tanya jadwal (Ya: draf booking, Tidak: AI dokter), alihkan ke CS.";
  } else if (presetType === "filter_faq") {
    promptInstruction = "Buatkan alur filter FAQ & Komplain: jawab via AI RAG, jika pesan mengandung kata komplain/kecewa/retur alihkan langsung ke CS Manusia dengan notifikasi lonceng.";
  } else if (presetType === "kuesioner") {
    promptInstruction = "Buatkan alur kuesioner & Google Sheets: kata kunci survei/masukan, tanya tingkat kepuasan, kirim hasil ke webhook Google Sheets, lalu kirim voucher nota B3.";
  }

  try {
    const res = await chatComplete([
      { role: "system", content: systemInstruction },
      { role: "user", content: `Rancang alur otomatisasi berikut: "${promptInstruction}"` },
    ]);

    let rawText = res.content || "";
    // Clean markdown codeblocks like ```json ... ```
    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

    const startBrace = rawText.indexOf("{");
    const endBrace = rawText.lastIndexOf("}");

    if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
      const cleanJsonStr = rawText.slice(startBrace, endBrace + 1);
      const parsed = JSON.parse(cleanJsonStr);
      if (parsed.name && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) && parsed.nodes.length >= 3) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[flow-generator] LLM parsing failed, using smart synthesizer:", err);
  }

  // SMART SYNTHESIZER FALLBACK: Generate tailored, rich multi-node flow graphs
  return synthesizeTailoredFlow(promptInstruction, promptLower, presetType);
}

function synthesizeTailoredFlow(promptText: string, promptLower: string, presetType?: string): GeneratedFlowStructure {
  const isQrisOrShop = presetType === "toko_qris" || promptLower.includes("qris") || promptLower.includes("toko") || promptLower.includes("harga") || promptLower.includes("pesan") || promptLower.includes("jualan") || promptLower.includes("porsi");
  const isBooking = presetType === "booking_klinik" || promptLower.includes("booking") || promptLower.includes("jadwal") || promptLower.includes("klinik") || promptLower.includes("salon") || promptLower.includes("servis");
  const isSheetOrWebhook = presetType === "kuesioner" || promptLower.includes("sheet") || promptLower.includes("webhook") || promptLower.includes("survei") || promptLower.includes("kuesioner");

  if (isQrisOrShop) {
    return {
      name: "Alur Otomatisasi Toko & Pembayaran QRIS",
      description: "Otomatisasi katalog foto produk, konfirmasi pesanan, dan penerbitan QRIS Midtrans B2.",
      nodes: [
        {
          id: "node-1",
          type: "triggerNode",
          position: { x: 250, y: 50 },
          data: { label: "Pesan WA Masuk", triggerType: "keyword", keywords: "harga,promo,menu,pesan,beli" },
        },
        {
          id: "node-2",
          type: "mediaNode",
          position: { x: 250, y: 190 },
          data: { label: "Kirim Foto Menu & Katalog", mediaType: "image", caption: "Berikut foto menu dan varian rasa favorit kami 🍲" },
        },
        {
          id: "node-3",
          type: "conditionNode",
          position: { x: 250, y: 330 },
          data: { label: "Apakah Pembeli Setuju Beli?", yesKeywords: "ya,pesan,setuju,beli,ok,mau" },
        },
        {
          id: "node-4a",
          type: "actionNode",
          position: { x: 90, y: 470 },
          data: { label: "Buat Link QRIS Midtrans (B2)", actionType: "send_qris_b2" },
        },
        {
          id: "node-[5a]",
          type: "mediaNode",
          position: { x: 90, y: 610 },
          data: { label: "Kirim Bukti QRIS & Nota (B3)", mediaType: "image", caption: "Silakan scan kode QRIS di atas untuk pembayaran instan 📲" },
        },
        {
          id: "node-4b",
          type: "aiNode",
          position: { x: 410, y: 470 },
          data: { label: "AI RAG Rekomendasi Varian Lain", systemPrompt: "Rekomendasikan produk favorit dan tawarkan bantuan lain." },
        },
        {
          id: "node-5b",
          type: "handoverNode",
          position: { x: 410, y: 610 },
          data: { label: "Alihkan ke CS jika Butuh Bantuan", note: "Alihkan ke CS jika pertanyaan tidak terjawab." },
        },
      ],
      edges: [
        { id: "e1-2", source: "node-1", target: "node-2" },
        { id: "e2-3", source: "node-2", target: "node-3" },
        { id: "e3-4a", source: "node-3", target: "node-4a", sourceHandle: "yes" },
        { id: "e4a-5a", source: "node-4a", target: "node-[5a]" },
        { id: "e3-4b", source: "node-3", target: "node-4b", sourceHandle: "no" },
        { id: "e4b-5b", source: "node-4b", target: "node-5b" },
      ],
    };
  }

  if (isBooking) {
    return {
      name: "Alur Reservasi & Booking Schedular",
      description: "Otomatisasi informasi pricelist, pencatatan jadwal booking, dan handover CS.",
      nodes: [
        {
          id: "node-1",
          type: "triggerNode",
          position: { x: 250, y: 50 },
          data: { label: "Pesan WA Masuk", triggerType: "keyword", keywords: "booking,reservasi,jadwal,daftar" },
        },
        {
          id: "node-2",
          type: "mediaNode",
          position: { x: 250, y: 190 },
          data: { label: "Kirim Brosur Pricelist (PDF)", mediaType: "document", caption: "Berikut PDF katalog paket dan harga treatment kami 📄" },
        },
        {
          id: "node-3",
          type: "conditionNode",
          position: { x: 250, y: 330 },
          data: { label: "Apakah Sudah Memilih Tanggal?", yesKeywords: "ya,sudah,tanggal,besok,bisa" },
        },
        {
          id: "node-4a",
          type: "actionNode",
          position: { x: 90, y: 470 },
          data: { label: "Catat Draf Booking", actionType: "create_invoice_b1" },
        },
        {
          id: "node-5a",
          type: "handoverNode",
          position: { x: 90, y: 610 },
          data: { label: "Konfirmasi CS Manusia 🔔", note: "Notifikasi CS untuk konfirmasi slot reservasi." },
        },
        {
          id: "node-4b",
          type: "aiNode",
          position: { x: 410, y: 470 },
          data: { label: "AI RAG Tanya Jawab Spesialis", systemPrompt: "Jawab pertanyaan konsultasi seputar jadwal & promo." },
        },
      ],
      edges: [
        { id: "e1-2", source: "node-1", target: "node-2" },
        { id: "e2-3", source: "node-2", target: "node-3" },
        { id: "e3-4a", source: "node-3", target: "node-4a", sourceHandle: "yes" },
        { id: "e4a-5a", source: "node-4a", target: "node-5a" },
        { id: "e3-4b", source: "node-3", target: "node-4b", sourceHandle: "no" },
      ],
    };
  }

  if (isSheetOrWebhook) {
    return {
      name: "Alur Kuesioner & Webhook Google Sheets",
      description: "Otomatisasi evaluasi pelanggan dan sinkronisasi data ke Google Sheets.",
      nodes: [
        {
          id: "node-1",
          type: "triggerNode",
          position: { x: 250, y: 50 },
          data: { label: "Pesan WA Masuk", triggerType: "keyword", keywords: "survei,kuesioner,masukan,nilai" },
        },
        {
          id: "node-2",
          type: "aiNode",
          position: { x: 250, y: 190 },
          data: { label: "AI Tanya Jawab Evaluasi", systemPrompt: "Tanyakan nilai kepuasan 1-5 dan masukan saran." },
        },
        {
          id: "node-3",
          type: "webhookNode",
          position: { x: 250, y: 330 },
          data: { label: "Kirim Data ke Google Sheets", webhookUrl: "https://hooks.zapier.com/hooks/catch/..." },
        },
        {
          id: "node-4",
          type: "actionNode",
          position: { x: 250, y: 470 },
          data: { label: "Auto-Kirim Voucher (Nota B3)", actionType: "auto_nota_b3" },
        },
      ],
      edges: [
        { id: "e1-2", source: "node-1", target: "node-2" },
        { id: "e2-3", source: "node-2", target: "node-3" },
        { id: "e3-4", source: "node-3", target: "node-4" },
      ],
    };
  }

  // Default Custom Flow Generator from user's custom text
  const cleanTitle = promptText ? promptText.slice(0, 40) : "Alur Otomatisasi WA";
  return {
    name: `Alur Custom: ${cleanTitle}`,
    description: `Alur otomatisasi yang dirancang khusus dari prompt: "${promptText}"`,
    nodes: [
      {
        id: "node-1",
        type: "triggerNode",
        position: { x: 250, y: 50 },
        data: { label: "Pesan WA Masuk", triggerType: "keyword", keywords: "halo,promo,harga,pesan,info" },
      },
      {
        id: "node-2",
        type: "mediaNode",
        position: { x: 250, y: 190 },
        data: { label: "Kirim Foto / PDF Katalog", mediaType: "image", caption: `Berikut informasi katalog produk untuk: ${cleanTitle}` },
      },
      {
        id: "node-3",
        type: "conditionNode",
        position: { x: 250, y: 330 },
        data: { label: "Apakah Ingin Transaksi?", yesKeywords: "ya,pesan,beli,setuju,booking" },
      },
      {
        id: "node-4a",
        type: "actionNode",
        position: { x: 90, y: 470 },
        data: { label: "Buat Invoice & QRIS (B1/B2)", actionType: "send_qris_b2" },
      },
      {
        id: "node-4b",
        type: "aiNode",
        position: { x: 410, y: 470 },
        data: { label: "AI RAG Tanya Jawab Product", systemPrompt: "Bantu jelaskan produk lebih rinci." },
      },
      {
        id: "node-5b",
        type: "handoverNode",
        position: { x: 410, y: 610 },
        data: { label: "Alihkan ke CS Manusia 🔔", note: "Alihkan jika butuh penanganan manusia." },
      },
    ],
    edges: [
      { id: "e1-2", source: "node-1", target: "node-2" },
      { id: "e2-3", source: "node-2", target: "node-3" },
      { id: "e3-4a", source: "node-3", target: "node-4a", sourceHandle: "yes" },
      { id: "e3-4b", source: "node-3", target: "node-4b", sourceHandle: "no" },
      { id: "e4b-5b", source: "node-4b", target: "node-5b" },
    ],
  };
}
