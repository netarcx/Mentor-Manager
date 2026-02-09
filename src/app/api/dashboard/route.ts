import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO, currentTimeStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayISO();
    const now = currentTimeStr();

    console.log(`[Dashboard] Checking for current shifts - Date: ${today}, Time: ${now}`);

    // Current shifts: all shifts happening right now (handles overlapping shifts)
    const currentShifts = await prisma.shift.findMany({
      where: {
        date: today,
        startTime: { lte: now },
        endTime: { gte: now },
        cancelled: false,
      },
      include: {
        signups: {
          include: { mentor: true },
          orderBy: { signedUpAt: "asc" },
        },
      },
      orderBy: [{ startTime: "asc" }],
    });

    console.log(`[Dashboard] Found ${currentShifts.length} current shift(s)`);
    if (currentShifts.length > 0) {
      console.log(`[Dashboard] Current shifts:`, currentShifts.map(s => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        label: s.label,
        signupCount: s.signups.length
      })));
    }

    // Combine all current shifts into one view with all active mentors (deduplicated)
    const currentShift = currentShifts.length > 0
      ? {
          ...currentShifts[0],
          label: currentShifts.length > 1
            ? `${currentShifts.length} Active Shifts`
            : currentShifts[0].label,
          signups: Array.from(
            new Map(
              currentShifts
                .flatMap(shift => shift.signups)
                .map(signup => [signup.mentor.email || signup.mentor.id, signup])
            ).values()
          ),
        }
      : null;

    // Next shift: hasn't started yet
    const nextShift = await prisma.shift.findFirst({
      where: {
        cancelled: false,
        OR: [
          { date: today, startTime: { gt: now } },
          { date: { gt: today } },
        ],
      },
      include: {
        signups: {
          include: { mentor: true },
          orderBy: { signedUpAt: "asc" },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ currentShift, nextShift });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
