import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shifts = await prisma.shift.findMany({
    include: {
      template: true,
      _count: { select: { signups: true } },
      signups: {
        include: { mentor: { select: { id: true, name: true, email: true } } },
        orderBy: { signedUpAt: "asc" },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({ shifts });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { date, startTime, endTime, label } = await request.json();

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: "date, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        date,
        startTime,
        endTime,
        label: label || "",
      },
    });

    return NextResponse.json(shift);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
