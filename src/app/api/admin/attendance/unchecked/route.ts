import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mentorId = searchParams.get("mentorId");

  if (!mentorId) {
    return NextResponse.json({ error: "mentorId is required" }, { status: 400 });
  }

  try {
    const today = todayISO();

    const signups = await prisma.signup.findMany({
      where: {
        mentorId: parseInt(mentorId, 10),
        checkedInAt: null,
        shift: {
          date: { lte: today },
          cancelled: false,
        },
      },
      include: {
        shift: { select: { date: true, startTime: true, endTime: true } },
      },
      orderBy: { shift: { date: "desc" } },
    });

    return NextResponse.json({
      signups: signups.map((s) => ({
        id: s.id,
        shiftDate: s.shift.date,
        startTime: s.customStartTime || s.shift.startTime,
        endTime: s.customEndTime || s.shift.endTime,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
