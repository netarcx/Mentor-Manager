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

    const { status, matchKey, note } = await request.json();

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const log = await prisma.batteryLog.create({
      data: {
        batteryId,
        status,
        matchKey: matchKey || "",
        note: note || "",
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
