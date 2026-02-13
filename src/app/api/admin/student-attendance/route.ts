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

    const now = new Date();

    const result = students.map((s) => {
      let totalMinutes = 0;

      for (const a of s.attendances) {
        if (a.checkedOutAt) {
          // Completed session
          totalMinutes += (a.checkedOutAt.getTime() - a.checkedInAt.getTime()) / 60000;
        } else if (a.date === today) {
          // Still checked in today — use current time
          totalMinutes += (now.getTime() - a.checkedInAt.getTime()) / 60000;
        }
        // Past days without checkout are ignored (no way to know duration)
      }

      const totalHours = Math.round(totalMinutes / 6) / 10; // round to 1 decimal

      return {
        id: s.id,
        name: s.name,
        totalCheckIns: s.attendances.length,
        totalHours,
        attendanceRate:
          allDates.size > 0
            ? Math.round((s.attendances.length / allDates.size) * 100)
            : 0,
      };
    });

    const totalHoursAll = Math.round(result.reduce((sum, r) => sum + r.totalHours, 0) * 10) / 10;

    return NextResponse.json({
      students: result,
      stats: {
        totalStudents: students.length,
        totalDays: allDates.size,
        totalHours: totalHoursAll,
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
