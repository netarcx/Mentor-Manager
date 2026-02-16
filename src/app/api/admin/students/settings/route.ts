import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "student_attendance_enabled",
            "sheets_auto_sync_enabled",
            "sheets_sync_interval",
            "sheets_last_synced_at",
            "sheets_last_imported_at",
          ],
        },
      },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return NextResponse.json({
      enabled: map.get("student_attendance_enabled") === "true",
      sheetsAutoSync: map.get("sheets_auto_sync_enabled") !== "false", // default true
      sheetsSyncInterval: parseInt(map.get("sheets_sync_interval") || "60", 10),
      sheetsLastSynced: map.get("sheets_last_synced_at") || null,
      sheetsLastImported: map.get("sheets_last_imported_at") || null,
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
    const body = await request.json();

    const upserts: { key: string; value: string }[] = [];

    if ("enabled" in body) {
      upserts.push({ key: "student_attendance_enabled", value: body.enabled ? "true" : "false" });
    }
    if ("sheetsAutoSync" in body) {
      upserts.push({ key: "sheets_auto_sync_enabled", value: body.sheetsAutoSync ? "true" : "false" });
    }
    if ("sheetsSyncInterval" in body) {
      const interval = Math.max(5, Math.min(1440, parseInt(body.sheetsSyncInterval, 10) || 60));
      upserts.push({ key: "sheets_sync_interval", value: String(interval) });
    }

    if (upserts.length > 0) {
      await prisma.$transaction(
        upserts.map(({ key, value }) =>
          prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        )
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
