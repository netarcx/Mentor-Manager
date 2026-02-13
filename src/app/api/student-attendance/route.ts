import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayISO();
    const attendance = await prisma.studentAttendance.findMany({
      where: { date: today },
      select: { studentId: true, checkedInAt: true },
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
    const record = await prisma.studentAttendance.upsert({
      where: {
        studentId_date: { studentId: Number(studentId), date: today },
      },
      update: {},
      create: { studentId: Number(studentId), date: today },
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
