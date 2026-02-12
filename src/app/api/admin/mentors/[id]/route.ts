import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const mentorId = parseInt(id);
    if (isNaN(mentorId)) {
      return NextResponse.json({ error: "Invalid mentor ID" }, { status: 400 });
    }

    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const mentor = await prisma.mentor.update({
      where: { id: mentorId },
      data: { name: name.trim() },
    });

    return NextResponse.json({ mentor });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
