/** Simple word-ish chunker (~500 chars, ~80 overlap). */
export function chunkText(text: string, size = 500, overlap = 80): string[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return [];
  if (cleaned.length <= size) return [cleaned];

  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    let end = Math.min(i + size, cleaned.length);
    if (end < cleaned.length) {
      const slice = cleaned.slice(i, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" "),
      );
      if (breakAt > size * 0.4) end = i + breakAt + 1;
    }
    const part = cleaned.slice(i, end).trim();
    if (part) chunks.push(part);
    if (end >= cleaned.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
