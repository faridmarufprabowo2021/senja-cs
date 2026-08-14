import { describe, it, expect } from "vitest";
import { analyzeImage } from "./lib/vision.js";

describe("Vision Image Reader Helper", () => {
  it("should return image description string when image buffer is provided", async () => {
    const dummyImg = Buffer.from("fake-image-bytes");
    const result = await analyzeImage(dummyImg, "image/jpeg");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
