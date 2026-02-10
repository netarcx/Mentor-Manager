import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const today = todayISO();
    const { searchParams } = new URL(request.url);
    const includePast = searchParams.get("includePast") === "true";

    const shifts = await prisma.shift.findMany({
      where: {
        ...(!includePast && { date: { gte: today } }),
        cancelled: false,
      },
      include: {
        signups: {
          include: { mentor: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ shifts, today });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
