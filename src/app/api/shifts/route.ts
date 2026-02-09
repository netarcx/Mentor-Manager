import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export async function GET() {
  try {
    const today = todayISO();

    const shifts = await prisma.shift.findMany({
      where: {
        date: { gte: today },
        cancelled: false,
      },
      include: {
        signups: {
          include: { mentor: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ shifts });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
