import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { shiftDurationHours, todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");
    const today = todayISO();

    // Build date filter: always cap at today so future shifts don't count
    let shiftDateFilter: { gte?: string; lte: string } = { lte: today };
    let adjustmentDateFilter: { gte?: string; lte: string } = { lte: today };

    if (seasonId && seasonId !== "all") {
      const season = await prisma.season.findUnique({
        where: { id: parseInt(seasonId) },
      });
      if (season) {
        const endCap = season.endDate < today ? season.endDate : today;
        shiftDateFilter = { gte: season.startDate, lte: endCap };
        adjustmentDateFilter = { gte: season.startDate, lte: season.endDate };
      }
    }

    const signups = await prisma.signup.findMany({
      include: {
        mentor: true,
        shift: true,
      },
      where: {
        shift: {
          date: shiftDateFilter,
          cancelled: false,
        },
      },
    });

    const mentorMap = new Map<
      string,
      { name: string; email: string; hours: number; shifts: number; adjustmentHours: number }
    >();

    for (const signup of signups) {
      const key = signup.mentor.email;
      const existing = mentorMap.get(key) || {
        name: signup.mentor.name,
        email: signup.mentor.email,
        hours: 0,
        shifts: 0,
        adjustmentHours: 0,
      };
      existing.hours += shiftDurationHours(
        signup.shift.startTime,
        signup.shift.endTime
      );
      existing.shifts += 1;
      mentorMap.set(key, existing);
    }

    // Add manual hour adjustments (gracefully skip if table doesn't exist yet)
    try {
      const adjustments = await prisma.hourAdjustment.findMany({
        include: { mentor: true },
        where: { date: adjustmentDateFilter },
      });

      for (const adj of adjustments) {
        const key = adj.mentor.email;
        const existing = mentorMap.get(key) || {
          name: adj.mentor.name,
          email: adj.mentor.email,
          hours: 0,
          shifts: 0,
          adjustmentHours: 0,
        };
        existing.adjustmentHours += adj.hours;
        mentorMap.set(key, existing);
      }
    } catch {
      // hour_adjustments table may not exist yet if prisma db push hasn't run
    }

    const mentors = Array.from(mentorMap.values())
      .map((m) => ({
        mentorName: m.name,
        mentorEmail: m.email,
        totalHours: Math.round((m.hours + m.adjustmentHours) * 10) / 10,
        shiftCount: m.shifts,
        adjustmentHours: Math.round(m.adjustmentHours * 10) / 10,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    const totalHours = mentors.reduce((sum, m) => sum + m.totalHours, 0);
    const stats = {
      totalHours: Math.round(totalHours * 10) / 10,
      avgHoursPerMentor:
        mentors.length > 0
          ? Math.round((totalHours / mentors.length) * 10) / 10
          : 0,
      totalShifts: mentors.reduce((sum, m) => sum + m.shiftCount, 0),
      mentorCount: mentors.length,
    };

    return NextResponse.json({ mentors, stats, today });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
