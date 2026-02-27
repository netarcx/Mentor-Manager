import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const logs = await prisma.batteryLog.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      include: { battery: { select: { label: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Group by date string (YYYY-MM-DD)
    const byDate = new Map<
      string,
      {
        batteryStats: Map<
          number,
          { label: string; changes: number; matches: number }
        >;
        totalChanges: number;
      }
    >();

    for (const log of logs) {
      const dateKey = log.createdAt.toISOString().split("T")[0];

      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, { batteryStats: new Map(), totalChanges: 0 });
      }

      const day = byDate.get(dateKey)!;
      day.totalChanges++;

      if (!day.batteryStats.has(log.batteryId)) {
        day.batteryStats.set(log.batteryId, {
          label: log.battery.label,
          changes: 0,
          matches: 0,
        });
      }

      const stats = day.batteryStats.get(log.batteryId)!;
      stats.changes++;
      if (log.status === "in_robot_match") {
        stats.matches++;
      }
    }

    const days = Array.from(byDate.entries()).map(
      ([date, { batteryStats, totalChanges }]) => ({
        date,
        totalChanges,
        batteries: Array.from(batteryStats.values()).sort((a, b) =>
          a.label.localeCompare(b.label)
        ),
      })
    );

    return NextResponse.json({ days });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
