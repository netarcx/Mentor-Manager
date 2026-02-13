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

    // Build date filter from season
    let dateFilter: { gte?: string; lte?: string } | undefined;
    if (seasonId) {
      const season = await prisma.season.findUnique({
        where: { id: parseInt(seasonId, 10) },
      });
      if (season) {
        dateFilter = { gte: season.startDate, lte: season.endDate };
      }
    }

    // Get all signups with their shifts and mentors
    const signups = await prisma.signup.findMany({
      where: {
        shift: {
          cancelled: false,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
      },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        shift: { select: { id: true, date: true, startTime: true, endTime: true, label: true } },
      },
    });

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
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
