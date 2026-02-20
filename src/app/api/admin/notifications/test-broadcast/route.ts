import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getNotificationSettings, getAllBroadcastUrls } from "@/lib/notifications";
import { sendNotification } from "@/lib/apprise";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getNotificationSettings();

    const urls = getAllBroadcastUrls(settings);

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "No broadcast URLs configured. Add a Slack, Discord, or other URL first." },
        { status: 400 }
      );
    }

    // Test each URL individually so we can report per-URL results
    const results = await Promise.all(
      urls.map(async (url) => {
        // Derive a human-friendly label from the URL scheme
        const scheme = url.split("://")[0] || "unknown";
        const result = await sendNotification(
          [url],
          "Test Broadcast",
          "This is a test broadcast from UV PitCrew. If you see this, your integration is working!",
          "success"
        );
        return { url: scheme + "://***", ok: result.ok, error: result.error };
      })
    );

    const allOk = results.every((r) => r.ok);

    return NextResponse.json({ results, allOk }, { status: allOk ? 200 : 207 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
