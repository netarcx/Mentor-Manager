const APPRISE_URL = process.env.APPRISE_URL || "http://apprise:8000";

export async function sendNotification(
  urls: string[],
  title: string,
  body: string,
  type: "info" | "success" | "warning" | "failure" = "info"
): Promise<{ ok: boolean; error?: string }> {
  if (urls.length === 0) {
    return { ok: false, error: "No notification URLs provided" };
  }

  try {
    const res = await fetch(`${APPRISE_URL}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, title, body, type }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      return { ok: false, error: `Apprise returned ${res.status}: ${text}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Failed to reach Apprise: ${(err as Error).message}` };
  }
}

export async function isAppriseHealthy(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${APPRISE_URL}/status`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Build a mailto:// Apprise URL for a specific recipient.
 * Handles both path-based and query-param-based SMTP base URLs.
 */
export function buildMailtoUrl(smtpBaseUrl: string, recipientEmail: string): string {
  const base = smtpBaseUrl.replace(/\/+$/, "");
  // If the base URL uses query params (?user=...&pass=...), append recipient as &to=
  if (base.includes("?")) {
    return `${base}&to=${recipientEmail}`;
  }
  // Otherwise use path-based format: mailto://user:pass@host/recipient@example.com
  return `${base}/${recipientEmail}`;
}
