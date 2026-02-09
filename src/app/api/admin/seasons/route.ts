import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json({ seasons });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, startDate, endDate } = await request.json();

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "name, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const season = await prisma.season.create({
      data: { name, startDate, endDate },
    });

    return NextResponse.json(season);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
