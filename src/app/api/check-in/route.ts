import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { signupId } = await request.json();

    if (!signupId) {
      return NextResponse.json({ error: "signupId is required" }, { status: 400 });
    }

    const signup = await prisma.signup.findUnique({ where: { id: signupId } });
    if (!signup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    if (signup.checkedInAt) {
      return NextResponse.json({ error: "Already checked in" }, { status: 400 });
    }

    const updated = await prisma.signup.update({
      where: { id: signupId },
      data: { checkedInAt: new Date() },
    });

    return NextResponse.json({ success: true, checkedInAt: updated.checkedInAt });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { signupId } = await request.json();

    if (!signupId) {
      return NextResponse.json({ error: "signupId is required" }, { status: 400 });
    }

    await prisma.signup.update({
      where: { id: signupId },
      data: { checkedInAt: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
