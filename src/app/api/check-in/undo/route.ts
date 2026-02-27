import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { signupId } = await request.json();

    if (!signupId) {
      return NextResponse.json({ error: "signupId is required" }, { status: 400 });
    }

    const signup = await prisma.signup.findUnique({
      where: { id: signupId },
      include: { shift: { select: { date: true } } },
    });

    if (!signup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    if (!signup.checkedInAt) {
      return NextResponse.json({ error: "Not checked in" }, { status: 400 });
    }

    // Clear check-in for this signup and any auto-checked-in signups
    // for the same mentor on the same day
    await prisma.signup.updateMany({
      where: {
        mentorId: signup.mentorId,
        shift: { date: signup.shift.date },
        checkedInAt: { not: null },
      },
      data: { checkedInAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
