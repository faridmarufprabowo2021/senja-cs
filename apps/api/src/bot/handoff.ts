/** Smart handoff: keyword + skill routing (no ML). */

export type EscalateReason =
  | "keyword"
  | "max_turns"
  | "skill_route"
  | "empty_kb"
  | "manual";

export type SkillHit = {
  skill: string;
  preferredRole: "admin" | "agent";
  label: string;
};

const SKILL_ROUTES: {
  skill: string;
  preferredRole: "admin" | "agent";
  label: string;
  keywords: string[];
}[] = [
  {
    skill: "billing",
    preferredRole: "admin",
    label: "Billing / refund",
    keywords: [
      "refund",
      "bukti transfer",
      "salah transfer",
      "batal order",
      "ganti rugi",
      "double transfer",
    ],
  },
  {
    skill: "medical",
    preferredRole: "admin",
    label: "Medis / klinis",
    keywords: [
      "darurat medis",
      "emergency",
      "alergi obat",
      "efek samping parah",
      "pendarahan",
    ],
  },
  {
    skill: "complaint",
    preferredRole: "admin",
    label: "Komplain",
    keywords: ["komplain", "kecewa", "marah", "tipu", "scam", "ganti rugi"],
  },
];

export function matchSkill(text: string): SkillHit | null {
  const lower = text.toLowerCase();
  for (const route of SKILL_ROUTES) {
    if (route.keywords.some((k) => lower.includes(k))) {
      return {
        skill: route.skill,
        preferredRole: route.preferredRole,
        label: route.label,
      };
    }
  }
  return null;
}

export function matchHandoverKeyword(
  text: string,
  keywords: string[],
): string | null {
  const lower = text.toLowerCase();
  for (const k of keywords) {
    const key = k.toLowerCase().trim();
    if (!key) continue;
    if (lower === key || lower.includes(key)) return key;
  }
  return null;
}
