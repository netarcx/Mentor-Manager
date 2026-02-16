import "server-only";
import { prisma } from "@/lib/db";
import {
  todayISO,
  shiftDurationHours,
  formatTime,
  formatDateMedium,
} from "@/lib/utils";
import { sendNotification } from "@/lib/apprise";
import { MIN_MENTOR_SIGNUPS } from "@/lib/constants";

// --- Settings keys ---

const SETTINGS_KEYS = {
  enabled: "digest_enabled",
  frequency: "digest_frequency",
  day: "digest_day",
  time: "digest_time",
  lastSent: "digest_last_sent",
} as const;

export interface DigestSettings {
  enabled: boolean;
  frequency: "weekly" | "monthly";
  day: string;
  time: string;
  lastSent: string;
}

const DEFAULTS: DigestSettings = {
  enabled: false,
  frequency: "weekly",
  day: "1", // Monday
  time: "09:00",
  lastSent: "",
};

export async function getDigestSettings(): Promise<DigestSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(SETTINGS_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    enabled: map.get(SETTINGS_KEYS.enabled) === "true",
    frequency:
      (map.get(SETTINGS_KEYS.frequency) as "weekly" | "monthly") ||
      DEFAULTS.frequency,
    day: map.get(SETTINGS_KEYS.day) ?? DEFAULTS.day,
    time: map.get(SETTINGS_KEYS.time) ?? DEFAULTS.time,
    lastSent: map.get(SETTINGS_KEYS.lastSent) ?? DEFAULTS.lastSent,
  };
}

export async function saveDigestSettings(
  settings: Omit<DigestSettings, "lastSent">
): Promise<void> {
  const pairs = [
    { key: SETTINGS_KEYS.enabled, value: String(settings.enabled) },
    { key: SETTINGS_KEYS.frequency, value: settings.frequency },
    { key: SETTINGS_KEYS.day, value: settings.day },
    { key: SETTINGS_KEYS.time, value: settings.time },
  ];

  await prisma.$transaction(
    pairs.map(({ key, value }) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
}

// --- Digest building ---

function dateOffset(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prevMonthRange(todayStr: string): { start: string; end: string } {
  const [y, m] = todayStr.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  // Last day of previous month = day 0 of current month
  const lastDay = new Date(y, m - 1, 0).getDate();
  const end = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export async function buildDigest(): Promise<string> {
  const settings = await getDigestSettings();
  const today = todayISO();

  // Determine period
  let periodStart: string;
  let periodEnd: string;
  let periodLabel: string;

  if (settings.frequency === "monthly") {
    const range = prevMonthRange(today);
    periodStart = range.start;
    periodEnd = range.end;
    periodLabel = `Monthly Digest (${periodStart} to ${periodEnd})`;
  } else {
    periodStart = dateOffset(today, -7);
    periodEnd = dateOffset(today, -1);
    periodLabel = `Weekly Digest (${periodStart} to ${periodEnd})`;
  }

  const lines: string[] = [periodLabel, "=".repeat(periodLabel.length), ""];

  // --- Attendance stats for the period ---
  const signups = await prisma.signup.findMany({
    where: {
      shift: {
        cancelled: false,
        date: { gte: periodStart, lte: periodEnd },
      },
    },
    include: {
      mentor: { select: { name: true, email: true } },
      shift: { select: { id: true, startTime: true, endTime: true } },
    },
  });

  const totalSignups = signups.length;
  const totalCheckIns = signups.filter((s) => s.checkedInAt).length;
  const attendanceRate =
    totalSignups > 0 ? Math.round((totalCheckIns / totalSignups) * 100) : 0;

  // Count unique shifts
  const shiftIds = new Set(signups.map((s) => s.shiftId));

  lines.push("ATTENDANCE");
  lines.push(`  Shifts held: ${shiftIds.size}`);
  lines.push(`  Total signups: ${totalSignups}`);
  lines.push(`  Check-ins: ${totalCheckIns}`);
  lines.push(`  Attendance rate: ${attendanceRate}%`);
  lines.push("");

  // --- Top 5 mentors by hours ---
  const mentorMap = new Map<
    string,
    { name: string; hours: number; shifts: number }
  >();

  for (const signup of signups) {
    const key = signup.mentor.email;
    const existing = mentorMap.get(key) || {
      name: signup.mentor.name,
      hours: 0,
      shifts: 0,
    };
    const startTime = signup.customStartTime || signup.shift.startTime;
    const endTime = signup.customEndTime || signup.shift.endTime;
    existing.hours += shiftDurationHours(startTime, endTime);
    existing.shifts += 1;
    mentorMap.set(key, existing);
  }

  // Include hour adjustments
  try {
    const adjustments = await prisma.hourAdjustment.findMany({
      include: { mentor: { select: { name: true, email: true } } },
      where: { date: { gte: periodStart, lte: periodEnd } },
    });
    for (const adj of adjustments) {
      const key = adj.mentor.email;
      const existing = mentorMap.get(key) || {
        name: adj.mentor.name,
        hours: 0,
        shifts: 0,
      };
      existing.hours += adj.hours;
      mentorMap.set(key, existing);
    }
  } catch {
    // hour_adjustments table may not exist
  }

  const sortedMentors = Array.from(mentorMap.values())
    .map((m) => ({
      ...m,
      hours: Math.round(m.hours * 10) / 10,
    }))
    .sort((a, b) => b.hours - a.hours);

  const totalHours = sortedMentors.reduce((sum, m) => sum + m.hours, 0);

  lines.push("TOP MENTORS");
  if (sortedMentors.length === 0) {
    lines.push("  (No activity this period)");
  } else {
    const top5 = sortedMentors.slice(0, 5);
    for (let i = 0; i < top5.length; i++) {
      lines.push(
        `  ${i + 1}. ${top5[i].name} — ${top5[i].hours}h (${top5[i].shifts} shifts)`
      );
    }
  }
  lines.push("");

  // --- Upcoming shift coverage (next 7 days) ---
  const futureEnd = dateOffset(today, 7);
  const upcomingShifts = await prisma.shift.findMany({
    where: {
      date: { gte: today, lte: futureEnd },
      cancelled: false,
    },
    include: { _count: { select: { signups: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  lines.push("UPCOMING SHIFTS (next 7 days)");
  if (upcomingShifts.length === 0) {
    lines.push("  (No upcoming shifts)");
  } else {
    const grouped = new Map<
      string,
      { startTime: string; endTime: string; label: string; count: number }[]
    >();
    for (const s of upcomingShifts) {
      const arr = grouped.get(s.date) || [];
      arr.push({
        startTime: s.startTime,
        endTime: s.endTime,
        label: s.label,
        count: s._count.signups,
      });
      grouped.set(s.date, arr);
    }

    for (const [date, shifts] of grouped) {
      lines.push(`  ${formatDateMedium(date)}`);
      for (const s of shifts) {
        const timeRange = `${formatTime(s.startTime)}-${formatTime(s.endTime)}`;
        const label = s.label ? ` (${s.label})` : "";
        const warning =
          s.count < MIN_MENTOR_SIGNUPS ? " — Needs mentors!" : "";
        lines.push(
          `    ${timeRange}${label} — ${s.count} signed up${warning}`
        );
      }
    }
  }
  lines.push("");

  // --- Team stats ---
  lines.push("TEAM STATS");
  lines.push(`  Active mentors: ${mentorMap.size}`);
  lines.push(`  Total hours: ${Math.round(totalHours * 10) / 10}`);

  return lines.join("\n");
}

// --- Sending ---

export interface DigestResult {
  sent: boolean;
  error?: string;
}

export async function sendDigest(): Promise<DigestResult> {
  // Read broadcast URLs from notification settings
  const broadcastUrlSetting = await prisma.setting.findUnique({
    where: { key: "notifications_broadcast_urls" },
  });

  const broadcastUrls = (broadcastUrlSetting?.value || "")
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

  if (broadcastUrls.length === 0) {
    return { sent: false, error: "No broadcast URLs configured" };
  }

  const content = await buildDigest();

  const result = await sendNotification(
    broadcastUrls,
    "Team Digest Report",
    content,
    "info"
  );

  if (!result.ok) {
    return { sent: false, error: result.error || "Failed to send" };
  }

  // Record timestamp
  const now = new Date().toISOString();
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEYS.lastSent },
    update: { value: now },
    create: { key: SETTINGS_KEYS.lastSent, value: now },
  });

  return { sent: true };
}
