import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { enabled, targetDate, label } = await request.json();

    // Save countdown settings
    await prisma.setting.upsert({
      where: { key: "countdown_enabled" },
      update: { value: enabled ? "true" : "false" },
      create: { key: "countdown_enabled", value: enabled ? "true" : "false" },
    });

    await prisma.setting.upsert({
      where: { key: "countdown_target_date" },
      update: { value: targetDate || "" },
      create: { key: "countdown_target_date", value: targetDate || "" },
    });

    await prisma.setting.upsert({
      where: { key: "countdown_label" },
      update: { value: label || "" },
      create: { key: "countdown_label", value: label || "" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save countdown settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
