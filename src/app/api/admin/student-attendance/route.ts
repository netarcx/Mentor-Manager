import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");

    let dateFilter: { gte?: string; lte?: string } | undefined;
    if (seasonId) {
      const season = await prisma.season.findUnique({
        where: { id: parseInt(seasonId, 10) },
      });
      if (season) {
        dateFilter = { gte: season.startDate, lte: season.endDate };
      }
    }

    const students = await prisma.student.findMany({
      orderBy: { name: "asc" },
      include: {
        attendances: dateFilter ? { where: { date: dateFilter } } : true,
      },
    });

    // Count unique dates with any attendance in the period
    const allDates = new Set<string>();
    for (const s of students) {
      for (const a of s.attendances) allDates.add(a.date);
    }

    const result = students.map((s) => ({
      id: s.id,
      name: s.name,
      totalCheckIns: s.attendances.length,
      attendanceRate:
        allDates.size > 0
          ? Math.round((s.attendances.length / allDates.size) * 100)
          : 0,
    }));

    return NextResponse.json({
      students: result,
      stats: {
        totalStudents: students.length,
        totalDays: allDates.size,
        avgAttendanceRate:
          result.length > 0
            ? Math.round(
                result.reduce((sum, r) => sum + r.attendanceRate, 0) /
                  result.length
              )
            : 0,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
