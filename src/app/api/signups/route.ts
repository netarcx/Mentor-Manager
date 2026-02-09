import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { mentorId, shiftId, note } = await request.json();

    if (!mentorId || !shiftId) {
      return NextResponse.json(
        { error: "mentorId and shiftId are required" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.cancelled) {
      return NextResponse.json(
        { error: "Shift not found or cancelled" },
        { status: 404 }
      );
    }

    const signup = await prisma.signup.create({
      data: {
        mentorId,
        shiftId,
        note: note || "",
      },
      include: {
        shift: true,
        mentor: true,
      },
    });

    return NextResponse.json(signup);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Already signed up for this shift" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
