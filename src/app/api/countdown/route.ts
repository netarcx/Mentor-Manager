import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ["countdown_enabled", "countdown_target_date", "countdown_label", "countdown_show_shop_hours"],
        },
      },
    });

    const settingsMap = settings.reduce<Record<string, string>>((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    return NextResponse.json({
      enabled: settingsMap.countdown_enabled === "true",
      targetDate: settingsMap.countdown_target_date || "",
      label: settingsMap.countdown_label || "Event",
      showShopHours: settingsMap.countdown_show_shop_hours === "true",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
