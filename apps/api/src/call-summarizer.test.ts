import { describe, it, expect } from "vitest";
import { summarizeCall } from "./lib/call-summarizer.js";

describe("Call Summarizer Helper", () => {
  it("should return fallback summary object when transcript is short or mock", async () => {
    const text = "Pelanggan menanyakan harga paket reseller dan minta dikirimkan brosur.";
    const result = await summarizeCall(text);
    expect(result).toHaveProperty("summary");
    expect(Array.isArray(result.keyTakeaways)).toBe(true);
    expect(Array.isArray(result.actionItems)).toBe(true);
  });
});
