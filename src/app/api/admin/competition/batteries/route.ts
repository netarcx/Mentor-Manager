import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batteries = await prisma.battery.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      logs: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json({
    batteries: batteries.map((b) => ({
      id: b.id,
      label: b.label,
      sortOrder: b.sortOrder,
      active: b.active,
      currentStatus: b.logs[0]?.status || null,
      statusSince: b.logs[0]?.createdAt || null,
    })),
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { label } = await request.json();

    if (!label || !label.trim()) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    const maxItem = await prisma.battery.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const nextOrder = (maxItem?.sortOrder ?? -1) + 1;

    const battery = await prisma.battery.create({
      data: {
        label: label.trim(),
        sortOrder: nextOrder,
      },
    });

    return NextResponse.json(battery);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
