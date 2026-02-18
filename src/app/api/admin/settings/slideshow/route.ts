import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.setting.findMany({
    where: { key: { in: ["slideshow_interval", "slideshow_enabled"] } },
  });

  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  return NextResponse.json({
    interval: parseInt(map.slideshow_interval || "8", 10),
    enabled: map.slideshow_enabled !== "false",
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { interval, enabled } = await request.json();

    if (interval !== undefined) {
      await prisma.setting.upsert({
        where: { key: "slideshow_interval" },
        update: { value: String(interval) },
        create: { key: "slideshow_interval", value: String(interval) },
      });
    }

    if (enabled !== undefined) {
      await prisma.setting.upsert({
        where: { key: "slideshow_enabled" },
        update: { value: String(enabled) },
        create: { key: "slideshow_enabled", value: String(enabled) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Slideshow settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
