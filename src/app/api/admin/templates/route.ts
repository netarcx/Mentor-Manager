import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.shiftTemplate.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { dayOfWeek, startTime, endTime, label } = await request.json();

    if (dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: "dayOfWeek, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    const template = await prisma.shiftTemplate.create({
      data: {
        dayOfWeek,
        startTime,
        endTime,
        label: label || "",
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
