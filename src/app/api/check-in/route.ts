import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Bulk check-in: { signupIds: number[] } — requires admin auth
    if (body.signupIds && Array.isArray(body.signupIds)) {
      if (!(await isAdminAuthenticated())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const result = await prisma.signup.updateMany({
        where: {
          id: { in: body.signupIds },
          checkedInAt: null,
        },
        data: { checkedInAt: new Date() },
      });

      return NextResponse.json({ success: true, updated: result.count });
    }

    // Single check-in: { signupId: number }
    const { signupId } = body;

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
  } catch (error) {
    console.error(error);
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
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
