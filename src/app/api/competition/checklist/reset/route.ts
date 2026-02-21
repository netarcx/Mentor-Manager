import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    await prisma.setting.deleteMany({
      where: { key: "competition_checklist_state" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Checklist reset error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
