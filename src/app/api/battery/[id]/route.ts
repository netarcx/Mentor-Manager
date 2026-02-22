import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const battery = await prisma.battery.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!battery) {
      return NextResponse.json({ error: "Battery not found" }, { status: 404 });
    }

    const latestLog = battery.logs[0] || null;

    return NextResponse.json({
      id: battery.id,
      label: battery.label,
      active: battery.active,
      currentStatus: latestLog?.status || null,
      statusSince: latestLog?.createdAt || null,
      matchKey: latestLog?.matchKey || "",
      recentLogs: battery.logs.map((l) => ({
        id: l.id,
        status: l.status,
        matchKey: l.matchKey,
        note: l.note,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
