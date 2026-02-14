import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { appendRows } from "@/lib/google-sheets";

export async function POST(request: Request) {
  // Dual auth: admin session OR cron secret via x-api-key header
  const apiKey = request.headers.get("x-api-key");
  const cronSecret = process.env.CRON_SECRET;
  const isAdminSession = await isAdminAuthenticated();
  const isCronAuth = cronSecret && apiKey === cronSecret;

  if (!isAdminSession && !isCronAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check that Google Sheets env vars are configured
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SHEET_ID) {
      return NextResponse.json(
        { error: "Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SHEET_ID environment variables." },
        { status: 400 }
      );
    }

    // Get last sync timestamp
    const lastSyncRow = await prisma.setting.findUnique({
      where: { key: "sheets_last_synced_at" },
    });
    const lastSync = lastSyncRow?.value ? new Date(lastSyncRow.value) : new Date(0);

    // Find all attendance records with activity since last sync
    const records = await prisma.studentAttendance.findMany({
      where: {
        OR: [
          { checkedInAt: { gt: lastSync } },
          { checkedOutAt: { gt: lastSync } },
        ],
      },
      include: { student: { select: { name: true } } },
      orderBy: { checkedInAt: "asc" },
    });

    // Build rows for Google Sheets
    // Format: Timestamp | Clock in/out | Name | Primary Subteam worked with
    const events: { date: Date; type: string; name: string; subteam: string }[] = [];

    for (const record of records) {
      if (record.checkedInAt > lastSync) {
        events.push({
          date: record.checkedInAt,
          type: "Clock in",
          name: record.student.name,
          subteam: record.subteam || "",
        });
      }

      if (record.checkedOutAt && record.checkedOutAt > lastSync) {
        events.push({
          date: record.checkedOutAt,
          type: "Clock out",
          name: record.student.name,
          subteam: record.subteam || "",
        });
      }
    }

    // Sort by actual Date before formatting
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    const rows: string[][] = events.map((e) => [
      formatTimestamp(e.date),
      e.type,
      e.name,
      e.subteam,
    ]);

    if (rows.length > 0) {
      await appendRows(rows);
    }

    // Update last sync timestamp
    const now = new Date().toISOString();
    await prisma.setting.upsert({
      where: { key: "sheets_last_synced_at" },
      update: { value: now },
      create: { key: "sheets_last_synced_at", value: now },
    });

    return NextResponse.json({ success: true, rowsSynced: rows.length });
  } catch (error) {
    console.error("Google Sheets sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
}
