import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { appendRows, readAllRows } from "@/lib/google-sheets";

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

    // For cron calls, check if auto-sync is enabled and enough time has passed
    if (isCronAuth && !isAdminSession) {
      const settings = await prisma.setting.findMany({
        where: { key: { in: ["sheets_auto_sync_enabled", "sheets_sync_interval", "sheets_last_synced_at"] } },
      });
      const map = new Map(settings.map((s) => [s.key, s.value]));

      if (map.get("sheets_auto_sync_enabled") === "false") {
        return NextResponse.json({ success: true, skipped: true, reason: "Auto-sync disabled" });
      }

      const intervalMinutes = parseInt(map.get("sheets_sync_interval") || "60", 10);
      const lastSync = map.get("sheets_last_synced_at");
      if (lastSync) {
        const elapsed = (Date.now() - new Date(lastSync).getTime()) / 60000;
        if (elapsed < intervalMinutes) {
          return NextResponse.json({ success: true, skipped: true, reason: "Interval not reached" });
        }
      }
    }

    // --- Phase 1: Export local attendance to sheet ---
    const lastSyncRow = await prisma.setting.findUnique({
      where: { key: "sheets_last_synced_at" },
    });
    const lastSync = lastSyncRow?.value ? new Date(lastSyncRow.value) : new Date(0);

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

    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    const exportRows: string[][] = events.map((e) => [
      formatTimestamp(e.date),
      e.type,
      e.name,
      e.subteam,
    ]);

    if (exportRows.length > 0) {
      await appendRows(exportRows);
    }

    // --- Phase 2: Import from sheet into local DB ---
    const lastImportRow = await prisma.setting.findUnique({
      where: { key: "sheets_last_imported_at" },
    });
    const lastImport = lastImportRow?.value ? new Date(lastImportRow.value) : new Date(0);

    const sheetRows = await readAllRows();

    // Parse sheet rows into typed events
    const sheetEvents: { timestamp: Date; type: string; name: string; subteam: string }[] = [];
    for (const row of sheetRows) {
      if (!row[0] || !row[1] || !row[2]) continue;
      const timestamp = new Date(row[0]);
      if (isNaN(timestamp.getTime())) continue;
      // Only process rows newer than last import
      if (timestamp <= lastImport) continue;

      const type = row[1].trim();
      if (type !== "Clock in" && type !== "Clock out") continue;

      sheetEvents.push({
        timestamp,
        type,
        name: row[2].trim(),
        subteam: (row[3] || "").trim(),
      });
    }

    // Build a cache of existing students by name (case-insensitive)
    const allStudents = await prisma.student.findMany({ select: { id: true, name: true } });
    const studentByName = new Map<string, number>();
    for (const s of allStudents) {
      studentByName.set(s.name.toLowerCase(), s.id);
    }

    // Load existing attendance for deduplication
    // Get all unique dates from the sheet events we're about to process
    const eventDates = new Set(sheetEvents.map((e) => toDateISO(e.timestamp)));
    const existingAttendance = eventDates.size > 0
      ? await prisma.studentAttendance.findMany({
          where: { date: { in: [...eventDates] } },
          include: { student: { select: { name: true } } },
        })
      : [];

    // Build lookup: "name_lower|date" -> attendance record
    const attendanceByKey = new Map<string, typeof existingAttendance[number]>();
    for (const a of existingAttendance) {
      attendanceByKey.set(`${a.student.name.toLowerCase()}|${a.date}`, a);
    }

    let imported = 0;

    for (const event of sheetEvents) {
      const nameLower = event.name.toLowerCase();
      const dateISO = toDateISO(event.timestamp);
      const key = `${nameLower}|${dateISO}`;

      // Auto-create student if unknown
      let studentId = studentByName.get(nameLower);
      if (!studentId) {
        const created = await prisma.student.create({ data: { name: event.name } });
        studentId = created.id;
        studentByName.set(nameLower, studentId);
      }

      const existing = attendanceByKey.get(key);

      if (event.type === "Clock in") {
        if (existing) {
          // Check if this is a duplicate (timestamps within 2 minutes)
          const diff = Math.abs(existing.checkedInAt.getTime() - event.timestamp.getTime());
          if (diff < 120000) continue; // Skip duplicate
          // Different check-in time on same day — already has a record, skip
          continue;
        }

        // Create new attendance record
        const record = await prisma.studentAttendance.create({
          data: {
            studentId,
            date: dateISO,
            checkedInAt: event.timestamp,
            subteam: event.subteam,
          },
          include: { student: { select: { name: true } } },
        });
        attendanceByKey.set(key, record);
        imported++;
      } else if (event.type === "Clock out") {
        if (existing && !existing.checkedOutAt) {
          // Update checkout time
          const updated = await prisma.studentAttendance.update({
            where: { id: existing.id },
            data: { checkedOutAt: event.timestamp },
            include: { student: { select: { name: true } } },
          });
          attendanceByKey.set(key, updated);
          imported++;
        }
        // If no existing record or already checked out, skip
      }
    }

    // Update sync timestamps
    const now = new Date().toISOString();
    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "sheets_last_synced_at" },
        update: { value: now },
        create: { key: "sheets_last_synced_at", value: now },
      }),
      prisma.setting.upsert({
        where: { key: "sheets_last_imported_at" },
        update: { value: now },
        create: { key: "sheets_last_imported_at", value: now },
      }),
    ]);

    return NextResponse.json({
      success: true,
      exported: exportRows.length,
      imported,
    });
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

function toDateISO(date: Date): string {
  // Convert to Chicago timezone date string
  const parts = date.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).split("-");
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}
