import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayISO();
    const attendance = await prisma.studentAttendance.findMany({
      where: { date: today },
      select: { studentId: true, checkedInAt: true, checkedOutAt: true },
    });
    return NextResponse.json({ date: today, attendance });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { studentId } = await request.json();
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
        data: { studentId: sid, date: today },
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
      data: { checkedInAt: new Date(), checkedOutAt: null },
    });
    return NextResponse.json({ success: true, status: "checked_in", record });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
