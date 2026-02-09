import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { shiftDurationHours } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");

    let dateFilter: { gte?: string; lte?: string } | undefined;

    if (seasonId && seasonId !== "all") {
      const season = await prisma.season.findUnique({
        where: { id: parseInt(seasonId) },
      });
      if (season) {
        dateFilter = { gte: season.startDate, lte: season.endDate };
      }
    }

    const signups = await prisma.signup.findMany({
      include: {
        mentor: true,
        shift: true,
      },
      where: dateFilter
        ? {
            shift: {
              date: dateFilter,
              cancelled: false,
            },
          }
        : {
            shift: { cancelled: false },
          },
    });

    const mentorMap = new Map<
      string,
      { name: string; email: string; hours: number; shifts: number }
    >();

    for (const signup of signups) {
      const key = signup.mentor.email;
      const existing = mentorMap.get(key) || {
        name: signup.mentor.name,
        email: signup.mentor.email,
        hours: 0,
        shifts: 0,
      };
      existing.hours += shiftDurationHours(
        signup.shift.startTime,
        signup.shift.endTime
      );
      existing.shifts += 1;
      mentorMap.set(key, existing);
    }

    const mentors = Array.from(mentorMap.values())
      .sort((a, b) => b.hours - a.hours)
      .map((m) => ({
        mentorName: m.name,
        mentorEmail: m.email,
        totalHours: Math.round(m.hours * 10) / 10,
        shiftCount: m.shifts,
      }));

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

    return NextResponse.json({ mentors, stats });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
