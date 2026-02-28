import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  try {
    const { id, logId } = await params;
    const batteryId = parseInt(id, 10);
    const logIdNum = parseInt(logId, 10);

    const log = await prisma.batteryLog.findUnique({
      where: { id: logIdNum },
    });

    if (!log || log.batteryId !== batteryId) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    const { voltage, note } = await request.json();

    if (voltage !== undefined && voltage !== null) {
      if (typeof voltage !== "number" || voltage < 0 || voltage > 20) {
        return NextResponse.json(
          { error: "voltage must be a number between 0 and 20" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.batteryLog.update({
      where: { id: logIdNum },
      data: {
        ...(voltage !== undefined && { voltage: voltage }),
        ...(note !== undefined && { note: note }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
