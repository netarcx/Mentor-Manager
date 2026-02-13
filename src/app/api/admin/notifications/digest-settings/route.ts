import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getDigestSettings, saveDigestSettings } from "@/lib/digest";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getDigestSettings();
    return NextResponse.json(settings);
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
    const { enabled, frequency, day, time } = await request.json();

    await saveDigestSettings({
      enabled: Boolean(enabled),
      frequency: frequency === "monthly" ? "monthly" : "weekly",
      day: String(day ?? "1"),
      time: String(time ?? "09:00"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
