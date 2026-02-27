import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: { in: ["competition_enabled", "student_attendance_enabled"] },
      },
      select: { key: true, value: true },
    });

    const map = new Map(rows.map((r) => [r.key, r.value]));

    return NextResponse.json({
      competition: map.get("competition_enabled") === "true",
      students: map.get("student_attendance_enabled") === "true",
    });
  } catch {
    return NextResponse.json({ competition: false, students: false });
  }
}
