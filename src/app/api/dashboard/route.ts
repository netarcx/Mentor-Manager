import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO, currentTimeStr, shiftDurationHours } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayISO();
    const now = currentTimeStr();

    // Run all queries in parallel
    const [currentShifts, nextShift, futureShifts, brandingSettings, countdownSettings, cleanupSettings, quoteResult, goal, announcementSettings, slideshowImages, slideshowSettings] =
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
              include: { mentor: { select: { id: true, name: true, avatarPath: true } } },
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
              include: { mentor: { select: { id: true, name: true, avatarPath: true } } },
              orderBy: { signedUpAt: "asc" },
            },
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        // Future shifts (all upcoming, beyond current/next — filtered client-side)
        prisma.shift.findMany({
          where: {
            cancelled: false,
            OR: [
              { date: today, startTime: { gt: now } },
              { date: { gt: today } },
            ],
          },
          include: {
            signups: {
              include: { mentor: { select: { id: true, name: true, avatarPath: true } } },
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
            key: { in: ["countdown_enabled", "countdown_target_date", "countdown_label", "countdown_show_shop_hours"] },
          },
        }),
        // Cleanup settings
        prisma.setting.findMany({
          where: {
            key: { in: ["cleanup_sound_minutes", "cleanup_display_minutes", "sound_volume"] },
          },
        }),
        // Quote (count + single fetch)
        getRandomQuote(),
        // Today's goals
        prisma.dailyGoal.findUnique({ where: { date: today } }),
        // Announcement + goals settings
        prisma.setting.findMany({
          where: { key: { in: ["announcement_enabled", "announcement_text", "goals_enabled"] } },
        }),
        // Slideshow images
        prisma.slideshowImage.findMany({
          orderBy: { sortOrder: "asc" },
          select: { id: true },
        }),
        // Slideshow settings
        prisma.setting.findMany({
          where: { key: { in: ["slideshow_interval", "slideshow_enabled"] } },
        }),
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
                .map(signup => [signup.mentor.id, signup])
            ).values()
          ),
        }
      : null;

    // Build branding object
    const brandingDefaults: Record<string, string> = {
      app_name: "UV PitCrew",
      app_title: "UV PitCrew",
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
    const showShopHours = countdownMap.countdown_show_shop_hours === "true";
    const countdownEnabled = countdownMap.countdown_enabled === "true";
    const countdownTargetDate = countdownMap.countdown_target_date || "";

    // Calculate shop hours remaining if enabled
    let shopHoursRemaining = 0;
    if (countdownEnabled && showShopHours && countdownTargetDate) {
      const remainingShifts = await prisma.shift.findMany({
        where: {
          cancelled: false,
          date: { gte: today, lte: countdownTargetDate },
        },
        select: { date: true, startTime: true, endTime: true },
      });

      for (const shift of remainingShifts) {
        // Skip today's shifts that have already ended
        if (shift.date === today && shift.endTime <= now) continue;
        shopHoursRemaining += shiftDurationHours(shift.startTime, shift.endTime);
      }

      shopHoursRemaining = Math.round(shopHoursRemaining * 10) / 10;
    }

    const countdown = {
      enabled: countdownEnabled,
      targetDate: countdownTargetDate,
      label: countdownMap.countdown_label || "Event",
      showShopHours,
      shopHoursRemaining,
    };

    // Build announcement object
    const announcementMap: Record<string, string> = {};
    for (const s of announcementSettings) announcementMap[s.key] = s.value;
    const announcement = {
      enabled: announcementMap.announcement_enabled === "true",
      text: announcementMap.announcement_text || "",
    };

    // Goals enabled (default true for backwards compatibility)
    const goalsEnabled = announcementMap.goals_enabled !== "false";

    // Determine if current shift is the last of the day
    // It's the last if no other shift on the same day starts at or after it ends
    let isLastShiftOfDay = false;
    if (currentShift) {
      const laterToday = futureShifts.filter(
        (s) => s.date === currentShift.date && s.id !== currentShift.id
      );
      isLastShiftOfDay = laterToday.length === 0;
    }

    // Build cleanup config
    const cleanupMap: Record<string, string> = {};
    for (const s of cleanupSettings) cleanupMap[s.key] = s.value;
    const cleanupConfig = {
      soundMinutes: parseInt(cleanupMap.cleanup_sound_minutes || "20", 10),
      displayMinutes: parseInt(cleanupMap.cleanup_display_minutes || "10", 10),
      soundVolume: parseFloat(cleanupMap.sound_volume || "0.5"),
    };

    // Build slideshow object
    const slideshowMap: Record<string, string> = {};
    for (const s of slideshowSettings) slideshowMap[s.key] = s.value;
    const slideshow = {
      images: slideshowImages.map((img) => img.id),
      interval: parseInt(slideshowMap.slideshow_interval || "8", 10),
      enabled: slideshowMap.slideshow_enabled !== "false",
    };

    // Filter out current and next shift from the future list
    const currentId = currentShift?.id;
    const nextId = nextShift?.id;
    const filteredFuture = futureShifts.filter(
      (s) => s.id !== currentId && s.id !== nextId
    );

    return NextResponse.json({
      currentShift,
      nextShift,
      futureShifts: filteredFuture,
      isLastShiftOfDay,
      cleanupConfig,
      branding,
      countdown,
      quote: quoteResult,
      goals: goal?.text || "",
      goalsEnabled,
      announcement,
      slideshow,
    });
  } catch (error) {
    console.error(error);
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
    const tenMinBlock = Math.floor(now.getMinutes() / 10);
    const seed = now.getFullYear() * 100000000 + (now.getMonth() + 1) * 1000000 + now.getDate() * 10000 + now.getHours() * 10 + tenMinBlock;
    const index = seed % count;

    const quotes = await prisma.quote.findMany({
      where: { active: true },
      select: { text: true, author: true },
      skip: index,
      take: 1,
    });
    return quotes[0] || null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
