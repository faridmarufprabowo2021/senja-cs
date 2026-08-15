import { prisma } from "../lib/prisma.js";
import { dispatchDailyReport } from "./daily-report.js";

const lastSentDateMap = new Map<string, string>(); // tenantId -> "YYYY-MM-DD"

export async function checkAndDispatchDailyReports(): Promise<{ checked: number; sent: number }> {
  let checked = 0;
  let sent = 0;

  try {
    const now = new Date();
    // Get current WIB time (Asia/Jakarta)
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    const currentTimeStr = new Intl.DateTimeFormat("en-GB", options).format(now); // e.g. "21:00"
    const todayStr = now.toISOString().split("T")[0]!; // e.g. "2026-08-15"

    const allSettings = await prisma.botSettings.findMany({
      where: {
        dailyReportEnabled: true,
      },
    });

    for (const settings of allSettings) {
      checked++;
      const targetTime = settings.dailyReportTime || "21:00";
      const lastSentDate = lastSentDateMap.get(settings.tenantId);

      // Check if current HH:mm matches configured report time and not already sent today
      if (currentTimeStr === targetTime && lastSentDate !== todayStr) {
        console.info(
          `[dailyReportScheduler] Triggering scheduled Daily Report for tenant ${settings.tenantId} at ${currentTimeStr} WIB...`,
        );

        const res = await dispatchDailyReport(settings.tenantId);
        console.info(`[dailyReportScheduler] Report dispatch result: ${res.message}`);

        if (res.ok) {
          lastSentDateMap.set(settings.tenantId, todayStr);
          sent++;
        }
      }
    }
  } catch (err) {
    console.error("[dailyReportScheduler] Error running daily report check:", err);
  }

  return { checked, sent };
}

export function startDailyReportScheduler() {
  console.info("[dailyReportScheduler] Automated Daily Executive Report Engine started (Interval: 60s)");
  setInterval(() => {
    void checkAndDispatchDailyReports();
  }, 60 * 1000);
}
