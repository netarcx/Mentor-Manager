import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { todayISO } from "@/lib/utils";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    const studentId = searchParams.get("studentId");
    const today = todayISO();

    let dateFilter: { gte?: string; lte?: string } | undefined;
    if (seasonId) {
      const season = await prisma.season.findUnique({
        where: { id: parseInt(seasonId, 10) },
      });
      if (season) {
        dateFilter = { gte: season.startDate, lte: season.endDate };
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    if (dateFilter) where.date = dateFilter;
    if (studentId) where.studentId = parseInt(studentId, 10);

    const records = await prisma.studentAttendance.findMany({
      where,
      include: { student: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { checkedInAt: "asc" }],
    });

    const now = new Date();

    // Group by date
    const dateMap = new Map<string, Array<{
      studentId: number;
      studentName: string;
      checkedInAt: string;
      checkedOutAt: string | null;
      duration: number | null; // minutes
    }>>();

    for (const r of records) {
      let duration: number | null = null;
      if (r.checkedOutAt) {
        duration = (r.checkedOutAt.getTime() - r.checkedInAt.getTime()) / 60000;
      } else if (r.date === today) {
        duration = (now.getTime() - r.checkedInAt.getTime()) / 60000;
      }

      const entry = {
        studentId: r.studentId,
        studentName: r.student.name,
        checkedInAt: r.checkedInAt.toISOString(),
        checkedOutAt: r.checkedOutAt?.toISOString() ?? null,
        duration: duration !== null ? Math.round(duration) : null,
      };

      const existing = dateMap.get(r.date);
      if (existing) {
        existing.push(entry);
      } else {
        dateMap.set(r.date, [entry]);
      }
    }

    const days = Array.from(dateMap.entries()).map(([date, entries]) => ({
      date,
      entries,
      totalStudents: entries.length,
      totalMinutes: entries.reduce((sum, e) => sum + (e.duration ?? 0), 0),
    }));

    // Summary stats
    const totalSessions = records.length;
    const uniqueDates = new Set(records.map((r) => r.date));
    const totalMinutesAll = days.reduce((sum, d) => sum + d.totalMinutes, 0);
    const uniqueStudents = new Set(records.map((r) => r.studentId));

    // All students for filter dropdown
    const allStudents = await prisma.student.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      days,
      students: allStudents,
      stats: {
        totalSessions,
        totalDays: uniqueDates.size,
        totalStudents: uniqueStudents.size,
        totalHours: Math.round(totalMinutesAll / 6) / 10,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
