import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_STATUSES = ["charging", "in_robot_match", "in_robot_testing", "idle"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batteryId = parseInt(id, 10);

    const battery = await prisma.battery.findUnique({ where: { id: batteryId } });
    if (!battery) {
      return NextResponse.json({ error: "Battery not found" }, { status: 404 });
    }

    const { status, matchKey, note, voltage } = await request.json();

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (voltage !== undefined && voltage !== null) {
      if (typeof voltage !== "number" || voltage < 0 || voltage > 20) {
        return NextResponse.json(
          { error: "voltage must be a number between 0 and 20" },
          { status: 400 }
        );
      }
    }

    const log = await prisma.batteryLog.create({
      data: {
        batteryId,
        status,
        matchKey: matchKey || "",
        note: note || "",
        ...(voltage !== undefined && voltage !== null && { voltage }),
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
