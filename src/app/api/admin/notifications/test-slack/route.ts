import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sendNotification } from "@/lib/apprise";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { webhookUrl } = await request.json();

    if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
      return NextResponse.json(
        { error: "Invalid Slack webhook URL. It should start with https://hooks.slack.com/services/" },
        { status: 400 }
      );
    }

    const result = await sendNotification(
      [webhookUrl],
      "Test from Mentor Manager",
      "Slack integration is working! You will receive notifications here.",
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
