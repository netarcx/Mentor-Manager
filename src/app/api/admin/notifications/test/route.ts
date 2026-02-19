import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getNotificationSettings, getAllBroadcastUrls, getSmtpBaseUrl } from "@/lib/notifications";
import { sendNotification, buildMailtoUrl } from "@/lib/apprise";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getNotificationSettings();

    const urls: string[] = getAllBroadcastUrls(settings);

    const smtpBase = getSmtpBaseUrl(settings);
    if (smtpBase && settings.emailAddress) {
      // Send test email to the sender's own address
      urls.push(buildMailtoUrl(smtpBase, settings.emailAddress));
    }

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "No notification URLs configured. Add an SMTP URL or broadcast URL first." },
        { status: 400 }
      );
    }

    const result = await sendNotification(
      urls,
      "Test Notification",
      "This is a test notification from Mentor Manager. If you see this, notifications are working!",
      "success"
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
