import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";
import { maybeImportFromSheets } from "@/lib/sheets-auto-sync";

export const dynamic = "force-dynamic";

async function isEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: "student_attendance_enabled" },
  });
  return row?.value === "true";
}

export async function GET() {
  try {
    if (!(await isEnabled())) {
      return NextResponse.json({ enabled: false, date: "", attendance: [] });
    }

    // Auto-import from Google Sheets if interval has elapsed
    let sheetsImported = false;
    try {
      const result = await maybeImportFromSheets();
      if (result && (result.imported > 0 || result.studentsCreated > 0)) {
        sheetsImported = true;
      }
    } catch {
      // Never break the student page due to sheets errors
    }

    const today = todayISO();
    const [attendance, pinRow, captainPinRow, subteamsRow] = await Promise.all([
      prisma.studentAttendance.findMany({
        where: { date: today },
        select: { studentId: true, checkedInAt: true, checkedOutAt: true, subteam: true },
      }),
      prisma.setting.findUnique({ where: { key: "student_pin" } }),
      prisma.setting.findUnique({ where: { key: "student_captain_pin" } }),
      prisma.setting.findUnique({ where: { key: "student_subteams" } }),
    ]);

    let subteams: string[] = [];
    if (subteamsRow?.value) {
      try { subteams = JSON.parse(subteamsRow.value); } catch { /* use default */ }
    }

    return NextResponse.json({
      date: today,
      attendance,
      pinRequired: !!pinRow?.value || !!captainPinRow?.value,
      subteams,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isEnabled())) {
      return NextResponse.json({ error: "Student check-in is not available" }, { status: 403 });
    }

    const { studentId, subteam } = await request.json();
    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const today = todayISO();
    const sid = Number(studentId);

    // Check for existing record today
    const existing = await prisma.studentAttendance.findUnique({
      where: { studentId_date: { studentId: sid, date: today } },
    });

    if (!existing) {
      // No record — check in
      const record = await prisma.studentAttendance.create({
        data: { studentId: sid, date: today, subteam: subteam || "" },
      });
      return NextResponse.json({ success: true, status: "checked_in", record });
    }

    if (!existing.checkedOutAt) {
      // Checked in but not out — check out
      const record = await prisma.studentAttendance.update({
        where: { id: existing.id },
        data: { checkedOutAt: new Date() },
      });
      return NextResponse.json({ success: true, status: "checked_out", record });
    }

    // Already checked out — re-check in (clear checkout, update check-in time)
    const record = await prisma.studentAttendance.update({
      where: { id: existing.id },
      data: { checkedInAt: new Date(), checkedOutAt: null, subteam: subteam || existing.subteam },
    });
    return NextResponse.json({ success: true, status: "checked_in", record });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
