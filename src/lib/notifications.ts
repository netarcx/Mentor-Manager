import "server-only";
import { prisma } from "@/lib/db";
import { todayISO, formatTime, formatDateMedium } from "@/lib/utils";
import { sendNotification, buildMailtoUrl } from "@/lib/apprise";
import { MIN_MENTOR_SIGNUPS } from "@/lib/constants";

// --- Settings keys ---

const SETTINGS_KEYS = {
  enabled: "notifications_enabled",
  emailEnabled: "notifications_email_enabled",
  emailAddress: "notifications_email_address",
  emailPassword: "notifications_email_password",
  emailSmtpHost: "notifications_email_smtp_host",
  emailSmtpPort: "notifications_email_smtp_port",
  broadcastUrls: "notifications_broadcast_urls",
  slackEnabled: "notifications_slack_enabled",
  slackWebhook: "notifications_slack_webhook",
  reminderDay: "notifications_reminder_day",
  reminderTime: "notifications_reminder_time",
  lookAheadDays: "notifications_look_ahead_days",
  lastReminderSent: "notifications_last_reminder_sent",
  siteUrl: "notifications_site_url",
  reminderSubject: "notifications_reminder_subject",
  reminderBody: "notifications_reminder_body",
} as const;

export interface NotificationSettings {
  enabled: boolean;
  emailEnabled: boolean;
  emailAddress: string;
  emailPassword: string;
  emailSmtpHost: string;
  emailSmtpPort: string;
  broadcastUrls: string;
  slackEnabled: boolean;
  slackWebhook: string;
  reminderDay: string;
  reminderTime: string;
  lookAheadDays: number;
  lastReminderSent: string;
  siteUrl: string;
  reminderSubject: string;
  reminderBody: string;
}

const DEFAULT_REMINDER_BODY = `Hi {name},

You haven't signed up for any upcoming shifts in the next {days} days.

Upcoming shifts:
{shifts}

Sign up here: {link}`;

const DEFAULTS: NotificationSettings = {
  enabled: false,
  emailEnabled: false,
  emailAddress: "",
  emailPassword: "",
  emailSmtpHost: "smtp.gmail.com",
  emailSmtpPort: "587",
  broadcastUrls: "",
  slackEnabled: false,
  slackWebhook: "",
  reminderDay: "1", // Monday (0=Sunday)
  reminderTime: "09:00",
  lookAheadDays: 7,
  lastReminderSent: "",
  siteUrl: "https://mentors.swrobotics.com",
  reminderSubject: "Reminder: Sign Up for Upcoming Shifts",
  reminderBody: DEFAULT_REMINDER_BODY,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(SETTINGS_KEYS) } },
  });

  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    enabled: map.get(SETTINGS_KEYS.enabled) === "true",
    emailEnabled: map.get(SETTINGS_KEYS.emailEnabled) === "true",
    emailAddress: map.get(SETTINGS_KEYS.emailAddress) ?? DEFAULTS.emailAddress,
    emailPassword: map.get(SETTINGS_KEYS.emailPassword) ?? DEFAULTS.emailPassword,
    emailSmtpHost: map.get(SETTINGS_KEYS.emailSmtpHost) ?? DEFAULTS.emailSmtpHost,
    emailSmtpPort: map.get(SETTINGS_KEYS.emailSmtpPort) ?? DEFAULTS.emailSmtpPort,
    broadcastUrls: map.get(SETTINGS_KEYS.broadcastUrls) ?? DEFAULTS.broadcastUrls,
    slackEnabled: map.get(SETTINGS_KEYS.slackEnabled) === "true",
    slackWebhook: map.get(SETTINGS_KEYS.slackWebhook) ?? DEFAULTS.slackWebhook,
    reminderDay: map.get(SETTINGS_KEYS.reminderDay) ?? DEFAULTS.reminderDay,
    reminderTime: map.get(SETTINGS_KEYS.reminderTime) ?? DEFAULTS.reminderTime,
    lookAheadDays: parseInt(map.get(SETTINGS_KEYS.lookAheadDays) ?? String(DEFAULTS.lookAheadDays), 10),
    lastReminderSent: map.get(SETTINGS_KEYS.lastReminderSent) ?? DEFAULTS.lastReminderSent,
    siteUrl: map.get(SETTINGS_KEYS.siteUrl) ?? DEFAULTS.siteUrl,
    reminderSubject: map.get(SETTINGS_KEYS.reminderSubject) ?? DEFAULTS.reminderSubject,
    reminderBody: map.get(SETTINGS_KEYS.reminderBody) ?? DEFAULTS.reminderBody,
  };
}

export async function saveNotificationSettings(
  settings: Omit<NotificationSettings, "lastReminderSent">
): Promise<void> {
  const pairs: { key: string; value: string }[] = [
    { key: SETTINGS_KEYS.enabled, value: String(settings.enabled) },
    { key: SETTINGS_KEYS.emailEnabled, value: String(settings.emailEnabled) },
    { key: SETTINGS_KEYS.emailAddress, value: settings.emailAddress },
    { key: SETTINGS_KEYS.emailPassword, value: settings.emailPassword },
    { key: SETTINGS_KEYS.emailSmtpHost, value: settings.emailSmtpHost },
    { key: SETTINGS_KEYS.emailSmtpPort, value: settings.emailSmtpPort },
    { key: SETTINGS_KEYS.broadcastUrls, value: settings.broadcastUrls },
    { key: SETTINGS_KEYS.slackEnabled, value: String(settings.slackEnabled) },
    { key: SETTINGS_KEYS.slackWebhook, value: settings.slackWebhook },
    { key: SETTINGS_KEYS.reminderDay, value: settings.reminderDay },
    { key: SETTINGS_KEYS.reminderTime, value: settings.reminderTime },
    { key: SETTINGS_KEYS.lookAheadDays, value: String(settings.lookAheadDays) },
    { key: SETTINGS_KEYS.siteUrl, value: settings.siteUrl },
    { key: SETTINGS_KEYS.reminderSubject, value: settings.reminderSubject },
    { key: SETTINGS_KEYS.reminderBody, value: settings.reminderBody },
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

// --- Email URL helper ---

/**
 * Build the Apprise SMTP base URL from structured email settings.
 * Returns empty string if email is not configured.
 */
export function getSmtpBaseUrl(settings: NotificationSettings): string {
  if (!settings.emailEnabled || !settings.emailAddress || !settings.emailPassword) {
    return "";
  }
  const host = settings.emailSmtpHost || "smtp.gmail.com";
  const port = settings.emailSmtpPort || "587";
  const user = encodeURIComponent(settings.emailAddress);
  const pass = encodeURIComponent(settings.emailPassword);
  return `mailtos://${host}:${port}?user=${user}&pass=${pass}&from=${user}`;
}

// --- Broadcast URL helper ---

export function getAllBroadcastUrls(settings: NotificationSettings): string[] {
  const urls: string[] = [];

  if (settings.slackEnabled && settings.slackWebhook.trim()) {
    urls.push(settings.slackWebhook.trim());
  }

  const textareaUrls = settings.broadcastUrls
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);
  urls.push(...textareaUrls);

  return urls;
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
    include: { _count: { select: { signups: true } } },
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
    select: { id: true, name: true, email: true },
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
      signupCount: s._count.signups,
    })),
    lookAheadDays: settings.lookAheadDays,
  };
}

interface ShiftSummaryItem {
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  signupCount: number;
}

export function buildShiftSummary(shifts: ShiftSummaryItem[]): string {
  if (shifts.length === 0) return "  (No upcoming shifts)";

  const grouped = new Map<string, ShiftSummaryItem[]>();
  for (const shift of shifts) {
    const existing = grouped.get(shift.date);
    if (existing) {
      existing.push(shift);
    } else {
      grouped.set(shift.date, [shift]);
    }
  }

  const lines: string[] = [];
  for (const [date, dayShifts] of grouped) {
    lines.push(formatDateMedium(date));
    for (const s of dayShifts) {
      const timeRange = `${formatTime(s.startTime)}-${formatTime(s.endTime)}`;
      const label = s.label ? ` (${s.label})` : "";
      const warning = s.signupCount < MIN_MENTOR_SIGNUPS ? " \u26A0\uFE0F Needs mentors!" : "";
      lines.push(`  ${timeRange}${label} \u2014 ${s.signupCount} signed up${warning}`);
    }
    lines.push("");
  }

  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

export interface SendResult {
  mentorsSent: number;
  broadcastSent: boolean;
  errors: string[];
}

function buildSignupLink(siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/signup`;
}

function applyTemplate(
  template: string,
  vars: { name: string; days: number; shifts: string; link: string }
): string {
  return template
    .replace(/\{name\}/g, vars.name)
    .replace(/\{days\}/g, String(vars.days))
    .replace(/\{shifts\}/g, vars.shifts)
    .replace(/\{link\}/g, vars.link);
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

  // Build shift summary for email body (grouped by day with warnings)
  const shiftSummary = buildShiftSummary(preview.upcomingShifts);
  const signupLink = buildSignupLink(settings.siteUrl || DEFAULTS.siteUrl);
  const subject = settings.reminderSubject || DEFAULTS.reminderSubject;
  const bodyTemplate = settings.reminderBody || DEFAULTS.reminderBody;

  // Send individual mentor emails via SMTP
  const smtpBase = getSmtpBaseUrl(settings);
  if (smtpBase) {
    for (const mentor of preview.mentors) {
      const url = buildMailtoUrl(smtpBase, mentor.email);
      const body = applyTemplate(bodyTemplate, {
        name: mentor.name,
        days: settings.lookAheadDays,
        shifts: shiftSummary,
        link: signupLink,
      });

      const result = await sendNotification(
        [url],
        subject,
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
  const broadcastUrlList = getAllBroadcastUrls(settings);

  if (broadcastUrlList.length > 0) {
    const mentorNames = preview.mentors.map((m) => m.name).join(", ");
    const broadcastBody = `Weekly Reminder Summary\n\n${preview.mentors.length} mentor(s) have not signed up for shifts in the next ${settings.lookAheadDays} days:\n${mentorNames}\n\nUpcoming shifts:\n${shiftSummary}\n\nSign up: ${signupLink}`;

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

export async function sendTestDigestEmail(recipientEmail: string): Promise<{ ok: boolean; error?: string }> {
  // Import here to avoid circular dependency at module level
  const { buildDigest } = await import("@/lib/digest");
  const settings = await getNotificationSettings();
  const smtpBase = getSmtpBaseUrl(settings);

  if (!smtpBase) {
    return { ok: false, error: "Email is not configured. Enable email and enter your credentials." };
  }

  const content = await buildDigest();
  const url = buildMailtoUrl(smtpBase, recipientEmail);

  return sendNotification(
    [url],
    "Team Digest Report (TEST)",
    content,
    "info"
  );
}

export async function sendTestReminder(recipientEmail: string): Promise<{ ok: boolean; error?: string }> {
  const settings = await getNotificationSettings();
  const preview = await previewReminders();
  const smtpBase = getSmtpBaseUrl(settings);

  if (!smtpBase) {
    return { ok: false, error: "Email is not configured. Enable email and enter your credentials." };
  }

  const shiftSummary = buildShiftSummary(preview.upcomingShifts);
  const signupLink = buildSignupLink(settings.siteUrl || DEFAULTS.siteUrl);
  const subject = settings.reminderSubject || DEFAULTS.reminderSubject;
  const bodyTemplate = settings.reminderBody || DEFAULTS.reminderBody;

  const body = applyTemplate(bodyTemplate, {
    name: "Admin (Test)",
    days: settings.lookAheadDays,
    shifts: shiftSummary,
    link: signupLink,
  });

  const url = buildMailtoUrl(smtpBase, recipientEmail);

  return sendNotification(
    [url],
    `${subject} (TEST)`,
    body,
    "info"
  );
}
