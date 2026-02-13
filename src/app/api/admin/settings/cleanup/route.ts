import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: { in: ["cleanup_sound_minutes", "cleanup_display_minutes"] },
      },
    });

    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    return NextResponse.json({
      soundMinutes: parseInt(map.cleanup_sound_minutes || "20", 10),
      displayMinutes: parseInt(map.cleanup_display_minutes || "10", 10),
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
    const { soundMinutes, displayMinutes } = await request.json();

    await prisma.setting.upsert({
      where: { key: "cleanup_sound_minutes" },
      update: { value: String(soundMinutes || 20) },
      create: { key: "cleanup_sound_minutes", value: String(soundMinutes || 20) },
    });

    await prisma.setting.upsert({
      where: { key: "cleanup_display_minutes" },
      update: { value: String(displayMinutes || 10) },
      create: { key: "cleanup_display_minutes", value: String(displayMinutes || 10) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
