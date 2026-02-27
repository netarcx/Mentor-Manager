import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeBatteries = await prisma.battery.findMany({
      where: { active: true },
      select: { id: true },
    });

    if (activeBatteries.length === 0) {
      return NextResponse.json({ reset: 0 });
    }

    await prisma.batteryLog.createMany({
      data: activeBatteries.map((b) => ({
        batteryId: b.id,
        status: "idle",
        note: "Daily reset",
      })),
    });

    return NextResponse.json({ reset: activeBatteries.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
