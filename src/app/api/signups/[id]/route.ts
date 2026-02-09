import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { mentorId } = await request.json();

    const signup = await prisma.signup.findUnique({
      where: { id: parseInt(id) },
    });

    if (!signup) {
      return NextResponse.json(
        { error: "Signup not found" },
        { status: 404 }
      );
    }

    if (signup.mentorId !== mentorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.signup.delete({ where: { id: parseInt(id) } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
