import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Attendance tracking started on this date — exclude earlier shifts
const ATTENDANCE_START = "2026-02-12";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    const today = todayISO();

    // Build date filter floored to attendance start date, capped at today
    let dateGte = ATTENDANCE_START;
    let dateLte = today;

    if (seasonId) {
      const season = await prisma.season.findUnique({
        where: { id: parseInt(seasonId, 10) },
      });
      if (season) {
        dateGte = season.startDate > ATTENDANCE_START ? season.startDate : ATTENDANCE_START;
        dateLte = season.endDate < today ? season.endDate : today;
      }
    }

    // Step 1: Get qualifying shift IDs (past/present only, no future)
    const shifts = await prisma.shift.findMany({
      where: {
        cancelled: false,
        date: { gte: dateGte, lte: dateLte },
      },
      select: { id: true },
    });
    const shiftIds = shifts.map((s) => s.id);

    // Step 2: Get signups for those shifts only
    const signups = shiftIds.length > 0
      ? await prisma.signup.findMany({
          where: { shiftId: { in: shiftIds } },
          include: {
            mentor: { select: { id: true, name: true, email: true } },
            shift: { select: { id: true, date: true, startTime: true, endTime: true, label: true } },
          },
        })
      : [];

    // Aggregate per mentor
    const mentorMap = new Map<number, {
      name: string;
      email: string;
      totalSignups: number;
      totalCheckIns: number;
    }>();

    for (const s of signups) {
      const existing = mentorMap.get(s.mentor.id);
      if (existing) {
        existing.totalSignups++;
        if (s.checkedInAt) existing.totalCheckIns++;
      } else {
        mentorMap.set(s.mentor.id, {
          name: s.mentor.name,
          email: s.mentor.email,
          totalSignups: 1,
          totalCheckIns: s.checkedInAt ? 1 : 0,
        });
      }
    }

    const mentors = Array.from(mentorMap.entries())
      .map(([id, data]) => ({
        id,
        ...data,
        attendanceRate: data.totalSignups > 0
          ? Math.round((data.totalCheckIns / data.totalSignups) * 100)
          : 0,
      }))
      .sort((a, b) => b.totalSignups - a.totalSignups);

    const totalSignups = signups.length;
    const totalCheckIns = signups.filter((s) => s.checkedInAt).length;

    return NextResponse.json({
      mentors,
      stats: {
        totalSignups,
        totalCheckIns,
        attendanceRate: totalSignups > 0 ? Math.round((totalCheckIns / totalSignups) * 100) : 0,
        mentorCount: mentorMap.size,
      },
      dateRange: { from: dateGte, to: dateLte || null },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
