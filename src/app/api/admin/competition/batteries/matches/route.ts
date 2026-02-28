import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.batteryLog.findMany({
    where: { matchKey: { not: "" } },
    orderBy: { createdAt: "desc" },
    include: { battery: { select: { label: true } } },
  });

  const grouped = new Map<
    string,
    { label: string; status: string; voltage: number | null; note: string; createdAt: Date }[]
  >();

  for (const log of logs) {
    const key = log.matchKey;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({
      label: log.battery.label,
      status: log.status,
      voltage: log.voltage,
      note: log.note,
      createdAt: log.createdAt,
    });
  }

  const matches = Array.from(grouped.entries()).map(([matchKey, batteries]) => ({
    matchKey,
    batteries,
  }));

  return NextResponse.json({ matches });
}
