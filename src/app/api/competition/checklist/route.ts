import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(request: NextRequest) {
  try {
    const { checkedIds } = await request.json();

    if (!Array.isArray(checkedIds)) {
      return NextResponse.json({ error: "checkedIds must be an array" }, { status: 400 });
    }

    await prisma.setting.upsert({
      where: { key: "competition_checklist_state" },
      update: { value: JSON.stringify(checkedIds) },
      create: { key: "competition_checklist_state", value: JSON.stringify(checkedIds) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Checklist update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
