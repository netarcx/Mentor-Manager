import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sendNotification } from "@/lib/apprise";
import { previewReminders, buildShiftSummary, getNotificationSettings } from "@/lib/notifications";
import { buildDigest } from "@/lib/digest";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { webhookUrl, type = "connection" } = await request.json();

    if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
      return NextResponse.json(
        { error: "Invalid Slack webhook URL. It should start with https://hooks.slack.com/services/" },
        { status: 400 }
      );
    }

    let title: string;
    let body: string;
    let notifType: "info" | "success" | "warning" = "success";

    if (type === "reminder") {
      const settings = await getNotificationSettings();
      const preview = await previewReminders();
      const shiftSummary = buildShiftSummary(preview.upcomingShifts);
      const mentorNames = preview.mentors.length > 0
        ? preview.mentors.map((m) => m.name).join(", ")
        : "(No mentors need reminders right now)";

      title = "Mentor Signup Reminder Summary";
      body = `Weekly Reminder Summary\n\n${preview.mentors.length} mentor(s) have not signed up for shifts in the next ${settings.lookAheadDays} days:\n${mentorNames}\n\nUpcoming shifts:\n${shiftSummary}`;
      notifType = "warning";
    } else if (type === "digest") {
      title = "Team Digest Report";
      body = await buildDigest();
      notifType = "info";
    } else {
      title = "Test from Mentor Manager";
      body = "Slack integration is working! You will receive notifications here.";
      notifType = "success";
    }

    const result = await sendNotification([webhookUrl], title, body, notifType);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
