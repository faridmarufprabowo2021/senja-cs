import { checkShippingRates, trackWaybill } from "./src/services/shipping.js";

async function runTest() {
  console.log("=========================================");
  console.log("🚀 TESTING LIVE SHIPPING API...");
  console.log("=========================================");

  const rates = await checkShippingRates({
    destination: "Jakarta Selatan",
    weightGrams: 1000,
  });

  console.log("\n📦 HASIL CEK ONGKIR (Surakarta -> Jakarta Selatan 1 kg):");
  console.log(JSON.stringify(rates, null, 2));

  const tracking = await trackWaybill({
    courier: "jne",
    waybillNumber: "JNE987654321",
  });

  console.log("\n🚚 HASIL LACAK RESI (JNE987654321):");
  console.log(JSON.stringify(tracking, null, 2));
  console.log("=========================================");
}

runTest();
