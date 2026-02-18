import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = {};
  if (studentId) where.studentId = parseInt(studentId, 10);
  if (date) where.date = date;

  try {
    const notes = await prisma.studentNote.findMany({
      where,
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Admin student notes GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
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
        author: "Admin",
      },
    });
    return NextResponse.json({ note });
  } catch (error) {
    console.error("Admin student notes POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
