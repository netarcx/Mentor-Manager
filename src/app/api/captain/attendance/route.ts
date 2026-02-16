import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function verifyCaptainPin(request: NextRequest): Promise<boolean> {
  const pin = request.headers.get("x-captain-pin");
  if (!pin) return false;
  const row = await prisma.setting.findUnique({ where: { key: "student_captain_pin" } });
  return !!row?.value && pin === row.value;
}

export async function GET(request: NextRequest) {
  if (!(await verifyCaptainPin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = todayISO();

    const [students, attendance, subteamsRow] = await Promise.all([
      prisma.student.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.studentAttendance.findMany({
        where: { date: today },
        select: { id: true, studentId: true, checkedInAt: true, checkedOutAt: true, subteam: true },
      }),
      prisma.setting.findUnique({ where: { key: "student_subteams" } }),
    ]);

    let subteams: string[] = [];
    if (subteamsRow?.value) {
      try { subteams = JSON.parse(subteamsRow.value); } catch { /* use default */ }
    }

    return NextResponse.json({ date: today, students, attendance, subteams });
  } catch (error) {
    console.error("Captain attendance GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyCaptainPin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action, studentId, time, checkedInAt, checkedOutAt, subteam } = await request.json();
    if (!action || !studentId) {
      return NextResponse.json({ error: "action and studentId are required" }, { status: 400 });
    }

    const today = todayISO();
    const sid = Number(studentId);

    if (action === "clock_in") {
      const clockTime = time ? new Date(time) : new Date();
      const record = await prisma.studentAttendance.upsert({
        where: { studentId_date: { studentId: sid, date: today } },
        create: {
          studentId: sid,
          date: today,
          checkedInAt: clockTime,
          subteam: subteam || "",
        },
        update: {
          checkedInAt: clockTime,
          checkedOutAt: null,
          ...(subteam !== undefined && { subteam }),
        },
      });
      return NextResponse.json({ success: true, record });
    }

    if (action === "clock_out") {
      const existing = await prisma.studentAttendance.findUnique({
        where: { studentId_date: { studentId: sid, date: today } },
      });
      if (!existing) {
        return NextResponse.json({ error: "Student is not clocked in" }, { status: 400 });
      }
      const clockTime = time ? new Date(time) : new Date();
      const record = await prisma.studentAttendance.update({
        where: { id: existing.id },
        data: {
          checkedOutAt: clockTime,
          ...(subteam !== undefined && { subteam }),
        },
      });
      return NextResponse.json({ success: true, record });
    }

    if (action === "update_time") {
      const existing = await prisma.studentAttendance.findUnique({
        where: { studentId_date: { studentId: sid, date: today } },
      });
      if (!existing) {
        return NextResponse.json({ error: "No attendance record to update" }, { status: 400 });
      }
      const data: Record<string, unknown> = {};
      if (checkedInAt) data.checkedInAt = new Date(checkedInAt);
      if (checkedOutAt) data.checkedOutAt = new Date(checkedOutAt);
      if (checkedOutAt === null) data.checkedOutAt = null;
      if (subteam !== undefined) data.subteam = subteam;

      const record = await prisma.studentAttendance.update({
        where: { id: existing.id },
        data,
      });
      return NextResponse.json({ success: true, record });
    }

    if (action === "clear") {
      const existing = await prisma.studentAttendance.findUnique({
        where: { studentId_date: { studentId: sid, date: today } },
      });
      if (!existing) {
        return NextResponse.json({ success: true });
      }
      await prisma.studentAttendance.delete({ where: { id: existing.id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Captain attendance POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
