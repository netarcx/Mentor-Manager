import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "competition_enabled",
            "competition_tba_api_key",
            "competition_team_key",
            "competition_event_key",
            "competition_poll_interval",
            "competition_robot_image_source",
            "competition_pit_timer_enabled",
            "competition_example_mode",
          ],
        },
      },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const apiKey = map.get("competition_tba_api_key") || "";
    const maskedKey =
      apiKey.length > 8
        ? apiKey.slice(0, 4) + "..." + apiKey.slice(-4)
        : apiKey
          ? "****"
          : "";

    return NextResponse.json({
      enabled: map.get("competition_enabled") === "true",
      tbaApiKey: maskedKey,
      teamKey: map.get("competition_team_key") || "",
      eventKey: map.get("competition_event_key") || "",
      pollInterval: parseInt(map.get("competition_poll_interval") || "60", 10),
      hasApiKey: !!apiKey,
      robotImageSource: map.get("competition_robot_image_source") || "none",
      pitTimerEnabled: map.get("competition_pit_timer_enabled") === "true",
      exampleMode: map.get("competition_example_mode") === "true",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { enabled, tbaApiKey, teamKey, eventKey, pollInterval, pitTimerEnabled, exampleMode } = await request.json();

    const updates: { key: string; value: string }[] = [];

    if (enabled !== undefined) {
      updates.push({ key: "competition_enabled", value: enabled ? "true" : "false" });
    }
    if (tbaApiKey !== undefined && tbaApiKey !== "") {
      updates.push({ key: "competition_tba_api_key", value: tbaApiKey });
    }
    if (teamKey !== undefined) {
      // Auto-format: if user enters "9431", store as "frc9431"
      const formatted = teamKey.startsWith("frc") ? teamKey : `frc${teamKey}`;
      updates.push({ key: "competition_team_key", value: formatted });
    }
    if (eventKey !== undefined) {
      updates.push({ key: "competition_event_key", value: eventKey });
    }
    if (pollInterval !== undefined) {
      const interval = Math.max(15, Math.min(300, parseInt(pollInterval, 10) || 60));
      updates.push({ key: "competition_poll_interval", value: String(interval) });
    }
    if (pitTimerEnabled !== undefined) {
      updates.push({ key: "competition_pit_timer_enabled", value: pitTimerEnabled ? "true" : "false" });
    }
    if (exampleMode !== undefined) {
      updates.push({ key: "competition_example_mode", value: exampleMode ? "true" : "false" });
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map(({ key, value }) =>
          prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        )
      );
    }

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
