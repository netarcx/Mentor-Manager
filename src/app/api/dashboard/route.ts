import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO, currentTimeStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayISO();
    const now = currentTimeStr();

    // Run all queries in parallel
    const [currentShifts, nextShift, brandingSettings, countdownSettings, quoteResult, goal] =
      await Promise.all([
        // Current shifts
        prisma.shift.findMany({
          where: {
            date: today,
            startTime: { lte: now },
            endTime: { gte: now },
            cancelled: false,
          },
          include: {
            signups: {
              include: { mentor: true },
              orderBy: { signedUpAt: "asc" },
            },
          },
          orderBy: [{ startTime: "asc" }],
        }),
        // Next shift
        prisma.shift.findFirst({
          where: {
            cancelled: false,
            OR: [
              { date: today, startTime: { gt: now } },
              { date: { gt: today } },
            ],
          },
          include: {
            signups: {
              include: { mentor: true },
              orderBy: { signedUpAt: "asc" },
            },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        // Branding settings
        prisma.setting.findMany({
          where: {
            key: {
              in: [
                "app_name", "app_title", "color_primary", "color_primary_dark",
                "color_primary_light", "color_navy", "color_navy_dark",
                "color_accent_bg", "logo_path",
              ],
            },
          },
        }),
        // Countdown settings
        prisma.setting.findMany({
          where: {
            key: { in: ["countdown_enabled", "countdown_target_date", "countdown_label"] },
          },
        }),
        // Quote (count + single fetch)
        getRandomQuote(),
        // Today's goals
        prisma.dailyGoal.findUnique({ where: { date: today } }),
      ]);

    // Combine current shifts
    const currentShift = currentShifts.length > 0
      ? {
          ...currentShifts[0],
          label: currentShifts.length > 1
            ? `${currentShifts.length} Active Shifts`
            : currentShifts[0].label,
          signups: Array.from(
            new Map(
              currentShifts
                .flatMap(shift => shift.signups)
                .map(signup => [signup.mentor.email || signup.mentor.id, signup])
            ).values()
          ),
        }
      : null;

    // Build branding object
    const brandingDefaults: Record<string, string> = {
      app_name: "FRC Workshop Signup",
      app_title: "FRC Workshop Signup",
      color_primary: "#51077a",
      color_primary_dark: "#3b0559",
      color_primary_light: "#c084fc",
      color_navy: "#2d3748",
      color_navy_dark: "#1a202c",
      color_accent_bg: "#f3e8ff",
      logo_path: "",
    };
    const brandingMap: Record<string, string> = {};
    for (const s of brandingSettings) {
      if (s.value) brandingMap[s.key] = s.value;
    }
    const branding = {
      appName: brandingMap.app_name || brandingDefaults.app_name,
      appTitle: brandingMap.app_title || brandingDefaults.app_title,
      colorPrimary: brandingMap.color_primary || brandingDefaults.color_primary,
      colorPrimaryDark: brandingMap.color_primary_dark || brandingDefaults.color_primary_dark,
      colorPrimaryLight: brandingMap.color_primary_light || brandingDefaults.color_primary_light,
      colorNavy: brandingMap.color_navy || brandingDefaults.color_navy,
      colorNavyDark: brandingMap.color_navy_dark || brandingDefaults.color_navy_dark,
      colorAccentBg: brandingMap.color_accent_bg || brandingDefaults.color_accent_bg,
      logoPath: brandingMap.logo_path || brandingDefaults.logo_path,
    };

    // Build countdown object
    const countdownMap: Record<string, string> = {};
    for (const s of countdownSettings) countdownMap[s.key] = s.value;
    const countdown = {
      enabled: countdownMap.countdown_enabled === "true",
      targetDate: countdownMap.countdown_target_date || "",
      label: countdownMap.countdown_label || "Event",
    };

    return NextResponse.json({
      currentShift,
      nextShift,
      branding,
      countdown,
      quote: quoteResult,
      goals: goal?.text || "",
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getRandomQuote() {
  try {
    const count = await prisma.quote.count({ where: { active: true } });
    if (count === 0) return null;

    const now = new Date();
    const hourSeed = now.getFullYear() * 1000000 + (now.getMonth() + 1) * 10000 + now.getDate() * 100 + now.getHours();
    const index = hourSeed % count;

    const quotes = await prisma.quote.findMany({
      where: { active: true },
      select: { text: true, author: true },
      skip: index,
      take: 1,
    });
    return quotes[0] || null;
  } catch {
    return null;
  }
}
