import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { sendNotification, buildMailtoUrl } from "@/lib/apprise";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { emailAddress, emailPassword, smtpHost, smtpPort } = await request.json();

    if (!emailAddress || !emailAddress.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (!emailPassword) {
      return NextResponse.json(
        { error: "App password is required" },
        { status: 400 }
      );
    }

    const host = smtpHost || "smtp.gmail.com";
    const port = smtpPort || "587";
    const user = encodeURIComponent(emailAddress);
    const pass = encodeURIComponent(emailPassword);
    const baseUrl = `mailtos://${host}:${port}?user=${user}&pass=${pass}&from=${user}`;
    const url = buildMailtoUrl(baseUrl, emailAddress);

    const result = await sendNotification(
      [url],
      "Test from UV PitCrew",
      "Email integration is working! You will receive notifications at this address.",
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
