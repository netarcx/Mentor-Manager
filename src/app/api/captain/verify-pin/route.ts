import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ success: false, error: "PIN is required" }, { status: 400 });
    }

    const captainPinRow = await prisma.setting.findUnique({
      where: { key: "student_captain_pin" },
    });

    if (!captainPinRow?.value) {
      return NextResponse.json(
        { success: false, error: "Captain access is not configured" },
        { status: 403 }
      );
    }

    if (pin !== captainPinRow.value) {
      return NextResponse.json({ success: false, error: "Incorrect PIN" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Captain PIN verification error:", error);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
