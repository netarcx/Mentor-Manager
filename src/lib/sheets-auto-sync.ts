import { prisma } from "@/lib/db";
import { readAllRows } from "@/lib/google-sheets";

// Module-level throttle — prevents hitting Sheets API on every polling request
let lastSyncTime = 0;
const MIN_INTERVAL_MS = 60_000; // 1 minute hard floor

/**
 * Lightweight auto-import from Google Sheets.
 * Called by student-facing GET endpoints on their 30s polling cycle.
 * Returns null if skipped, or { imported, studentsCreated } if sync ran.
 */
export async function maybeImportFromSheets(): Promise<{
  imported: number;
  studentsCreated: number;
} | null> {
  // Fast path: in-memory check (no DB hit)
  const now = Date.now();
  if (now - lastSyncTime < MIN_INTERVAL_MS) return null;

  // Check if Google Sheets is configured
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SHEET_ID) {
    return null;
  }

  // Check DB settings: is auto-sync enabled? Has the interval elapsed?
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "sheets_auto_sync_enabled",
          "sheets_sync_interval",
          "sheets_last_imported_at",
        ],
      },
    },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  if (map.get("sheets_auto_sync_enabled") === "false") {
    lastSyncTime = now; // Don't re-check settings until next interval
    return null;
  }

  const intervalMinutes = parseInt(
    map.get("sheets_sync_interval") || "60",
    10
  );
  const intervalMs = Math.max(intervalMinutes * 60_000, MIN_INTERVAL_MS);
  const lastImported = map.get("sheets_last_imported_at");

  if (lastImported) {
    const elapsed = now - new Date(lastImported).getTime();
    if (elapsed < intervalMs) {
      lastSyncTime = now;
      return null;
    }
  }

  // Mark sync in progress (prevents concurrent syncs from parallel requests)
  lastSyncTime = now;

  // Read all rows from sheet
  const sheetRows = await readAllRows();

  // Parse rows into typed events
  const sheetEvents: {
    timestamp: Date;
    type: string;
    name: string;
    subteam: string;
  }[] = [];
  for (const row of sheetRows) {
    if (!row[0] || !row[1] || !row[2]) continue;
    const timestamp = new Date(row[0]);
    if (isNaN(timestamp.getTime())) continue;

    const type = row[1].trim().toLowerCase();
    if (type !== "clock in" && type !== "clock out") continue;

    sheetEvents.push({
      timestamp,
      type: type === "clock in" ? "Clock in" : "Clock out",
      name: row[2].trim(),
      subteam: (row[3] || "").trim(),
    });
  }

  if (sheetEvents.length === 0) {
    await updateImportTimestamp();
    return { imported: 0, studentsCreated: 0 };
  }

  // Build student name cache
  const allStudents = await prisma.student.findMany({
    select: { id: true, name: true },
  });
  const studentByName = new Map<string, number>();
  for (const s of allStudents) {
    studentByName.set(s.name.toLowerCase(), s.id);
  }

  // Auto-create missing students
  let studentsCreated = 0;
  for (const row of sheetRows) {
    const name = (row[2] || "").trim();
    if (!name) continue;
    const nameLower = name.toLowerCase();
    if (!studentByName.has(nameLower)) {
      const created = await prisma.student.create({ data: { name } });
      studentByName.set(nameLower, created.id);
      studentsCreated++;
    }
  }

  // Load existing attendance for dedup
  const eventDates = new Set(sheetEvents.map((e) => toDateISO(e.timestamp)));
  const existingAttendance =
    eventDates.size > 0
      ? await prisma.studentAttendance.findMany({
          where: { date: { in: [...eventDates] } },
          include: { student: { select: { name: true } } },
        })
      : [];

  const attendanceByKey = new Map<
    string,
    (typeof existingAttendance)[number]
  >();
  for (const a of existingAttendance) {
    attendanceByKey.set(`${a.student.name.toLowerCase()}|${a.date}`, a);
  }

  // Import events with dedup
  let imported = 0;

  for (const event of sheetEvents) {
    const nameLower = event.name.toLowerCase();
    const dateISO = toDateISO(event.timestamp);
    const key = `${nameLower}|${dateISO}`;

    let studentId = studentByName.get(nameLower);
    if (!studentId) {
      const created = await prisma.student.create({
        data: { name: event.name },
      });
      studentId = created.id;
      studentByName.set(nameLower, studentId);
    }

    const existing = attendanceByKey.get(key);

    if (event.type === "Clock in") {
      if (existing) {
        // Duplicate check: timestamps within 2 minutes → skip
        const diff = Math.abs(
          existing.checkedInAt.getTime() - event.timestamp.getTime()
        );
        if (diff < 120_000) continue;
        // Different check-in time on same day — already has a record, skip
        continue;
      }

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
        const updated = await prisma.studentAttendance.update({
          where: { id: existing.id },
          data: { checkedOutAt: event.timestamp },
          include: { student: { select: { name: true } } },
        });
        attendanceByKey.set(key, updated);
        imported++;
      }
    }
  }

  await updateImportTimestamp();

  return { imported, studentsCreated };
}

async function updateImportTimestamp() {
  const now = new Date().toISOString();
  await prisma.setting.upsert({
    where: { key: "sheets_last_imported_at" },
    update: { value: now },
    create: { key: "sheets_last_imported_at", value: now },
  });
}

function toDateISO(date: Date): string {
  const parts = date
    .toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
    .split("-");
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}
