import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getDigestSettings, sendDigest } from "@/lib/digest";
import { todayISO, currentTimeStr } from "@/lib/utils";

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  const cronSecret = process.env.CRON_SECRET;
  const isAdminSession = await isAdminAuthenticated();
  const isCronAuth = cronSecret && apiKey === cronSecret;

  if (!isAdminSession && !isCronAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getDigestSettings();

    if (!settings.enabled) {
      return NextResponse.json({ error: "Digest is disabled" }, { status: 400 });
    }

    // Cron-triggered: check schedule
    if (isCronAuth && !isAdminSession) {
      const now = new Date();
      const centralStr = now.toLocaleString("en-US", {
        timeZone: "America/Chicago",
      });
      const centralDate = new Date(centralStr);
      const currentTime = currentTimeStr();

      if (settings.frequency === "weekly") {
        const currentDay = String(centralDate.getDay());
        if (currentDay !== settings.day) {
          return NextResponse.json({
            skipped: true,
            reason: "Not the scheduled day",
          });
        }
      } else {
        // monthly
        const currentDayOfMonth = String(centralDate.getDate());
        if (currentDayOfMonth !== settings.day) {
          return NextResponse.json({
            skipped: true,
            reason: "Not the scheduled day",
          });
        }
      }

      // Check time window (±30 min)
      const [schedH, schedM] = settings.time.split(":").map(Number);
      const [curH, curM] = currentTime.split(":").map(Number);
      if (Math.abs(curH * 60 + curM - (schedH * 60 + schedM)) > 30) {
        return NextResponse.json({
          skipped: true,
          reason: "Not within scheduled time window",
        });
      }

      // Check already sent today
      if (settings.lastSent) {
        const lastSent = new Date(settings.lastSent);
        const lastSentCentral = lastSent.toLocaleString("en-US", {
          timeZone: "America/Chicago",
        });
        const lastSentDate = new Date(lastSentCentral);
        const todayStr = todayISO();
        const lastSentDay = `${lastSentDate.getFullYear()}-${String(lastSentDate.getMonth() + 1).padStart(2, "0")}-${String(lastSentDate.getDate()).padStart(2, "0")}`;

        if (lastSentDay === todayStr) {
          return NextResponse.json({
            skipped: true,
            reason: "Already sent today",
          });
        }
      }
    }

    const result = await sendDigest();
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
