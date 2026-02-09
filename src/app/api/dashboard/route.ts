import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO, currentTimeStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayISO();
    const now = currentTimeStr();

    // Current shift: today, started but not ended
    const currentShift = await prisma.shift.findFirst({
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
    });

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
