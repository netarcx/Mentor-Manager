import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getNotificationSettings, sendReminders } from "@/lib/notifications";
import { todayISO, currentTimeStr } from "@/lib/utils";

export async function POST(request: Request) {
  // Dual auth: admin session OR cron secret via x-api-key header
  const apiKey = request.headers.get("x-api-key");
  const cronSecret = process.env.CRON_SECRET;
  const isAdminSession = await isAdminAuthenticated();
  const isCronAuth = cronSecret && apiKey === cronSecret;

  if (!isAdminSession && !isCronAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getNotificationSettings();

    if (!settings.enabled) {
      return NextResponse.json({ error: "Notifications are disabled" }, { status: 400 });
    }

    // If triggered by cron, check if it's the right day and time
    if (isCronAuth && !isAdminSession) {
      const now = new Date();
      // Get current day in Central Time
      const centralStr = now.toLocaleString("en-US", { timeZone: "America/Chicago" });
      const centralDate = new Date(centralStr);
      const currentDay = String(centralDate.getDay());
      const currentTime = currentTimeStr();

      if (currentDay !== settings.reminderDay) {
        return NextResponse.json({ skipped: true, reason: "Not the scheduled day" });
      }

      // Check if within the scheduled hour (allow ±30 min window)
      const [schedH, schedM] = settings.reminderTime.split(":").map(Number);
      const [curH, curM] = currentTime.split(":").map(Number);
      const schedMinutes = schedH * 60 + schedM;
      const curMinutes = curH * 60 + curM;

      if (Math.abs(curMinutes - schedMinutes) > 30) {
        return NextResponse.json({ skipped: true, reason: "Not within scheduled time window" });
      }

      // Check if already sent today
      if (settings.lastReminderSent) {
        const lastSent = new Date(settings.lastReminderSent);
        const lastSentDate = lastSent.toLocaleString("en-US", { timeZone: "America/Chicago" });
        const lastSentISO = new Date(lastSentDate);
        const todayStr = todayISO();
        const lastSentDay = `${lastSentISO.getFullYear()}-${String(lastSentISO.getMonth() + 1).padStart(2, "0")}-${String(lastSentISO.getDate()).padStart(2, "0")}`;

        if (lastSentDay === todayStr) {
          return NextResponse.json({ skipped: true, reason: "Already sent today" });
        }
      }
    }

    const result = await sendReminders();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
