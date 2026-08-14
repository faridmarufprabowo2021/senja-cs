/** Business hours check in tenant timezone (Asia/Jakarta default). */

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** Current minutes-from-midnight in IANA tz (fallback Asia/Jakarta). */
export function localMinutesNow(tz = "Asia/Jakarta"): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    const d = new Date();
    // rough WIB = UTC+7
    const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
    const wib = new Date(utc + 7 * 3600_000);
    return wib.getHours() * 60 + wib.getMinutes();
  }
}

export function isWithinBusinessHours(opts: {
  enabled: boolean;
  start: string;
  end: string;
  tz: string;
}): boolean {
  if (!opts.enabled) return true;
  const now = localMinutesNow(opts.tz);
  const start = parseHm(opts.start);
  const end = parseHm(opts.end);
  if (start === end) return true;
  if (start < end) return now >= start && now < end;
  // overnight window e.g. 22:00–06:00
  return now >= start || now < end;
}
