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

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const date = searchParams.get("date") || todayISO();

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  try {
    const notes = await prisma.studentNote.findMany({
      where: { studentId: parseInt(studentId, 10), date },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Captain notes GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyCaptainPin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { studentId, date, content } = await request.json();
    if (!studentId || !content?.trim()) {
      return NextResponse.json({ error: "studentId and content are required" }, { status: 400 });
    }

    const note = await prisma.studentNote.create({
      data: {
        studentId: Number(studentId),
        date: date || todayISO(),
        content: content.trim(),
        author: "Captain",
      },
    });
    return NextResponse.json({ note });
  } catch (error) {
    console.error("Captain notes POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
