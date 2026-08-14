import { describe, it, expect } from "vitest";
import { transcribeAudio } from "./lib/transcribe.js";

describe("Audio Transcriber Helper", () => {
  it("should return fallback string when audio buffer is provided without API key or mock", async () => {
    const dummyBuffer = Buffer.from("RIFF....WAVEfmt ");
    const text = await transcribeAudio(dummyBuffer, "test.ogg");
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });
});
