import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batteryId = parseInt(id, 10);

    const [battery, cycleCount] = await Promise.all([
      prisma.battery.findUnique({
        where: { id: batteryId },
        include: {
          logs: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      }),
      prisma.batteryLog.count({
        where: { batteryId, status: "in_robot_match" },
      }),
    ]);

    if (!battery) {
      return NextResponse.json({ error: "Battery not found" }, { status: 404 });
    }

    const latestLog = battery.logs[0] || null;

    return NextResponse.json({
      id: battery.id,
      label: battery.label,
      active: battery.active,
      retired: battery.retired,
      cycleCount,
      currentStatus: latestLog?.status || null,
      statusSince: latestLog?.createdAt || null,
      matchKey: latestLog?.matchKey || "",
      recentLogs: battery.logs.map((l) => ({
        id: l.id,
        status: l.status,
        matchKey: l.matchKey,
        note: l.note,
        voltage: l.voltage,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
