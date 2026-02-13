import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ["announcement_enabled", "announcement_text"] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return NextResponse.json({
      enabled: map.get("announcement_enabled") === "true",
      text: map.get("announcement_text") || "",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { enabled, text } = await request.json();

    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "announcement_enabled" },
        update: { value: enabled ? "true" : "false" },
        create: { key: "announcement_enabled", value: enabled ? "true" : "false" },
      }),
      prisma.setting.upsert({
        where: { key: "announcement_text" },
        update: { value: text || "" },
        create: { key: "announcement_text", value: text || "" },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
