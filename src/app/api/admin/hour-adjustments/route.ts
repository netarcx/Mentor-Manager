import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adjustments = await prisma.hourAdjustment.findMany({
      include: { mentor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ adjustments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { mentorId, hours, reason, date } = await request.json();

    if (!mentorId || typeof hours !== "number" || !date) {
      return NextResponse.json(
        { error: "mentorId, hours, and date are required" },
        { status: 400 }
      );
    }

    if (hours === 0) {
      return NextResponse.json(
        { error: "Hours must not be zero" },
        { status: 400 }
      );
    }

    const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } });
    if (!mentor) {
      return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
    }

    const adjustment = await prisma.hourAdjustment.create({
      data: {
        mentorId,
        hours,
        reason: reason || "",
        date,
      },
      include: { mentor: { select: { name: true, email: true } } },
    });

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
