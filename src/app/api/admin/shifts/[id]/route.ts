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
    const data = await request.json();

    const shift = await prisma.shift.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...(data.date && { date: data.date }),
        ...(data.startTime && { startTime: data.startTime }),
        ...(data.endTime && { endTime: data.endTime }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.cancelled !== undefined && { cancelled: data.cancelled }),
      },
    });

    return NextResponse.json(shift);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const shift = await prisma.shift.findUnique({
      where: { id: parseInt(id, 10) },
      include: { _count: { select: { signups: true } } },
    });

    if (shift && shift._count.signups > 0) {
      return NextResponse.json(
        { error: "Cannot delete a shift with signups. Cancel it instead." },
        { status: 400 }
      );
    }

    await prisma.shift.delete({ where: { id: parseInt(id, 10) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
