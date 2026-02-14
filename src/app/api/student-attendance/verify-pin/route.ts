import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    const [mentorRow, captainRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "student_pin" } }),
      prisma.setting.findUnique({ where: { key: "student_captain_pin" } }),
    ]);

    // If no PINs are configured, always succeed
    if (!mentorRow?.value && !captainRow?.value) {
      return NextResponse.json({ success: true, locksAt: getFallbackLockTime() });
    }

    // Accept either the mentor PIN or the captain PIN
    if (pin !== mentorRow?.value && pin !== captainRow?.value) {
      return NextResponse.json({ success: false, error: "Incorrect PIN" }, { status: 401 });
    }

    // Find today's last shift to calculate lock time
    const today = todayISO();
    const lastShift = await prisma.shift.findFirst({
      where: { date: today, cancelled: false },
      orderBy: { endTime: "desc" },
      select: { date: true, endTime: true },
    });

    let locksAt: string;
    if (lastShift) {
      // Parse the shift end time and add 20 minutes
      const [endH, endM] = lastShift.endTime.split(":").map(Number);
      const [year, month, day] = lastShift.date.split("-").map(Number);
      const endDate = new Date(year, month - 1, day, endH, endM + 20, 0);
      // If the calculated lock time is already in the past, use the fallback instead
      locksAt = endDate.getTime() > Date.now() ? endDate.toISOString() : getFallbackLockTime();
    } else {
      locksAt = getFallbackLockTime();
    }

    return NextResponse.json({ success: true, locksAt });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getFallbackLockTime(): string {
  // Fallback: 4 hours from now
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
}
