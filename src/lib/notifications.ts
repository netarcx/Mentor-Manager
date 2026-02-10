import "server-only";
import { prisma } from "@/lib/db";
import { todayISO, formatDate, formatTime } from "@/lib/utils";
import { sendNotification, buildMailtoUrl } from "@/lib/apprise";

// --- Settings keys ---

const SETTINGS_KEYS = {
  enabled: "notifications_enabled",
  smtpUrl: "notifications_smtp_url",
  broadcastUrls: "notifications_broadcast_urls",
  reminderDay: "notifications_reminder_day",
  reminderTime: "notifications_reminder_time",
  lookAheadDays: "notifications_look_ahead_days",
  lastReminderSent: "notifications_last_reminder_sent",
} as const;

export interface NotificationSettings {
  enabled: boolean;
  smtpUrl: string;
  broadcastUrls: string;
  reminderDay: string;
  reminderTime: string;
  lookAheadDays: number;
  lastReminderSent: string;
}

const DEFAULTS: NotificationSettings = {
  enabled: false,
  smtpUrl: "",
  broadcastUrls: "",
  reminderDay: "1", // Monday (0=Sunday)
  reminderTime: "09:00",
  lookAheadDays: 7,
  lastReminderSent: "",
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(SETTINGS_KEYS) } },
  });

  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    enabled: map.get(SETTINGS_KEYS.enabled) === "true",
    smtpUrl: map.get(SETTINGS_KEYS.smtpUrl) ?? DEFAULTS.smtpUrl,
    broadcastUrls: map.get(SETTINGS_KEYS.broadcastUrls) ?? DEFAULTS.broadcastUrls,
    reminderDay: map.get(SETTINGS_KEYS.reminderDay) ?? DEFAULTS.reminderDay,
    reminderTime: map.get(SETTINGS_KEYS.reminderTime) ?? DEFAULTS.reminderTime,
    lookAheadDays: parseInt(map.get(SETTINGS_KEYS.lookAheadDays) ?? String(DEFAULTS.lookAheadDays), 10),
    lastReminderSent: map.get(SETTINGS_KEYS.lastReminderSent) ?? DEFAULTS.lastReminderSent,
  };
}

export async function saveNotificationSettings(
  settings: Omit<NotificationSettings, "lastReminderSent">
): Promise<void> {
  const pairs: { key: string; value: string }[] = [
    { key: SETTINGS_KEYS.enabled, value: String(settings.enabled) },
    { key: SETTINGS_KEYS.smtpUrl, value: settings.smtpUrl },
    { key: SETTINGS_KEYS.broadcastUrls, value: settings.broadcastUrls },
    { key: SETTINGS_KEYS.reminderDay, value: settings.reminderDay },
    { key: SETTINGS_KEYS.reminderTime, value: settings.reminderTime },
    { key: SETTINGS_KEYS.lookAheadDays, value: String(settings.lookAheadDays) },
  ];

  for (const { key, value } of pairs) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

// --- Preview & Send ---

export interface MentorReminder {
  id: number;
  name: string;
  email: string;
}

export interface ReminderPreview {
  mentors: MentorReminder[];
  upcomingShifts: { id: number; date: string; startTime: string; endTime: string; label: string; signupCount: number }[];
  lookAheadDays: number;
}

/**
 * Find mentors who have no signups for any shift in the next N days.
 * Excludes @placeholder.local emails (admin bulk-created mentors).
 */
export async function previewReminders(): Promise<ReminderPreview> {
  const settings = await getNotificationSettings();
  const today = todayISO();

  // Calculate end date
  const todayDate = new Date(`${today}T00:00:00`);
  const endDate = new Date(todayDate);
  endDate.setDate(endDate.getDate() + settings.lookAheadDays);
  const endISO = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  // Get upcoming non-cancelled shifts
  const upcomingShifts = await prisma.shift.findMany({
    where: {
      date: { gte: today, lte: endISO },
      cancelled: false,
    },
    include: { signups: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  if (upcomingShifts.length === 0) {
    return { mentors: [], upcomingShifts: [], lookAheadDays: settings.lookAheadDays };
  }

  const shiftIds = upcomingShifts.map((s) => s.id);

  // Find mentors who do NOT have a signup for any upcoming shift
  // Exclude placeholder emails from admin bulk-signup
  const mentorsWithSignups = await prisma.signup.findMany({
    where: { shiftId: { in: shiftIds } },
    select: { mentorId: true },
    distinct: ["mentorId"],
  });
  const signedUpMentorIds = new Set(mentorsWithSignups.map((s) => s.mentorId));

  const allMentors = await prisma.mentor.findMany({
    where: {
      email: { not: { contains: "@placeholder.local" } },
    },
  });

  const mentorsToNotify = allMentors
    .filter((m) => !signedUpMentorIds.has(m.id))
    .map((m) => ({ id: m.id, name: m.name, email: m.email }));

  return {
    mentors: mentorsToNotify,
    upcomingShifts: upcomingShifts.map((s) => ({
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.label,
      signupCount: s.signups.length,
    })),
    lookAheadDays: settings.lookAheadDays,
  };
}

export interface SendResult {
  mentorsSent: number;
  broadcastSent: boolean;
  errors: string[];
}

export async function sendReminders(): Promise<SendResult> {
  const settings = await getNotificationSettings();
  const preview = await previewReminders();
  const errors: string[] = [];
  let mentorsSent = 0;
  let broadcastSent = false;

  if (preview.mentors.length === 0) {
    return { mentorsSent: 0, broadcastSent: false, errors: ["No mentors need reminders"] };
  }

  // Build shift summary for email body
  const shiftLines = preview.upcomingShifts
    .map((s) => `  ${formatDate(s.date)} ${formatTime(s.startTime)}-${formatTime(s.endTime)}${s.label ? ` (${s.label})` : ""} — ${s.signupCount} signed up`)
    .join("\n");

  // Send individual mentor emails via SMTP
  if (settings.smtpUrl) {
    for (const mentor of preview.mentors) {
      const url = buildMailtoUrl(settings.smtpUrl, mentor.email);
      const body = `Hi ${mentor.name},\n\nYou haven't signed up for any upcoming shifts in the next ${settings.lookAheadDays} days. Here are the available shifts:\n\n${shiftLines}\n\nPlease sign up at your earliest convenience!`;

      const result = await sendNotification(
        [url],
        "Reminder: Sign Up for Upcoming Shifts",
        body,
        "info"
      );

      if (result.ok) {
        mentorsSent++;
      } else {
        errors.push(`Failed to notify ${mentor.name}: ${result.error}`);
      }
    }
  }

  // Send broadcast summary
  const broadcastUrlList = settings.broadcastUrls
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

  if (broadcastUrlList.length > 0) {
    const mentorNames = preview.mentors.map((m) => m.name).join(", ");
    const broadcastBody = `Weekly Reminder Summary\n\n${preview.mentors.length} mentor(s) have not signed up for shifts in the next ${settings.lookAheadDays} days:\n${mentorNames}\n\nUpcoming shifts:\n${shiftLines}`;

    const result = await sendNotification(
      broadcastUrlList,
      "Mentor Signup Reminder Summary",
      broadcastBody,
      "warning"
    );

    if (result.ok) {
      broadcastSent = true;
    } else {
      errors.push(`Broadcast failed: ${result.error}`);
    }
  }

  // Record timestamp
  const now = new Date().toISOString();
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEYS.lastReminderSent },
    update: { value: now },
    create: { key: SETTINGS_KEYS.lastReminderSent, value: now },
  });

  return { mentorsSent, broadcastSent, errors };
}
