import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getNotificationSettings, saveNotificationSettings } from "@/lib/notifications";
import { isAppriseHealthy } from "@/lib/apprise";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getNotificationSettings();
    const appriseHealthy = await isAppriseHealthy();
    return NextResponse.json({ ...settings, appriseHealthy });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      enabled, emailEnabled, emailAddress, emailPassword, emailSmtpHost, emailSmtpPort,
      broadcastUrls, slackEnabled, slackWebhook, reminderDay, reminderTime, lookAheadDays,
      siteUrl, reminderSubject, reminderBody,
    } = body;

    await saveNotificationSettings({
      enabled: Boolean(enabled),
      emailEnabled: Boolean(emailEnabled),
      emailAddress: String(emailAddress ?? ""),
      emailPassword: String(emailPassword ?? ""),
      emailSmtpHost: String(emailSmtpHost || "smtp.gmail.com"),
      emailSmtpPort: String(emailSmtpPort || "587"),
      broadcastUrls: String(broadcastUrls ?? ""),
      slackEnabled: Boolean(slackEnabled),
      slackWebhook: String(slackWebhook ?? ""),
      reminderDay: String(reminderDay ?? "1"),
      reminderTime: String(reminderTime ?? "09:00"),
      lookAheadDays: Math.max(1, Math.min(30, parseInt(lookAheadDays, 10) || 7)),
      siteUrl: String(siteUrl ?? ""),
      reminderSubject: String(reminderSubject ?? ""),
      reminderBody: String(reminderBody ?? ""),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
