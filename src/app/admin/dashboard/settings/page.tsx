"use client";

import { useState, useEffect, useRef } from "react";

interface Branding {
  appName: string;
  appTitle: string;
  colorPrimary: string;
  colorPrimaryDark: string;
  colorPrimaryLight: string;
  colorNavy: string;
  colorNavyDark: string;
  colorAccentBg: string;
  logoPath: string;
  faviconPath: string;
}

export default function SettingsPage() {
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Branding state
  const [branding, setBranding] = useState<Branding | null>(null);
  const [appName, setAppName] = useState("");
  const [appTitle, setAppTitle] = useState("");
  const [colorPrimary, setColorPrimary] = useState("#51077a");
  const [colorPrimaryDark, setColorPrimaryDark] = useState("#3b0559");
  const [colorPrimaryLight, setColorPrimaryLight] = useState("#c084fc");
  const [colorNavy, setColorNavy] = useState("#2d3748");
  const [colorNavyDark, setColorNavyDark] = useState("#1a202c");
  const [colorAccentBg, setColorAccentBg] = useState("#f3e8ff");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const cleanupSoundInputRef = useRef<HTMLInputElement>(null);
  const [soundPath, setSoundPath] = useState("");
  const [cleanupSoundPath, setCleanupSoundPath] = useState("");

  // Countdown state
  const [countdownEnabled, setCountdownEnabled] = useState(false);
  const [countdownDate, setCountdownDate] = useState("");
  const [countdownLabel, setCountdownLabel] = useState("");

  // Notification state
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifSmtpUrl, setNotifSmtpUrl] = useState("");
  const [notifBroadcastUrls, setNotifBroadcastUrls] = useState("");
  const [notifReminderDay, setNotifReminderDay] = useState("1");
  const [notifReminderTime, setNotifReminderTime] = useState("09:00");
  const [notifLookAheadDays, setNotifLookAheadDays] = useState(7);
  const [notifLastSent, setNotifLastSent] = useState("");
  const [notifAppriseHealthy, setNotifAppriseHealthy] = useState<boolean | null>(null);
  const [notifPreview, setNotifPreview] = useState<{
    mentors: { id: number; name: string; email: string }[];
    upcomingShifts: { id: number; date: string; startTime: string; endTime: string; label: string; signupCount: number }[];
    lookAheadDays: number;
  } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [showTestEmail, setShowTestEmail] = useState(false);

  // Feedback state
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  useEffect(() => {
    async function fetchBranding() {
      try {
        const res = await fetch("/api/branding");
        const data: Branding = await res.json();
        setBranding(data);
        setAppName(data.appName);
        setAppTitle(data.appTitle);
        setColorPrimary(data.colorPrimary);
        setColorPrimaryDark(data.colorPrimaryDark);
        setColorPrimaryLight(data.colorPrimaryLight);
        setColorNavy(data.colorNavy);
        setColorNavyDark(data.colorNavyDark);
        setColorAccentBg(data.colorAccentBg);
      } catch {
        setError("Failed to load branding settings");
      }
    }

    async function fetchCountdown() {
      try {
        const res = await fetch("/api/countdown");
        const data = await res.json();
        setCountdownEnabled(data.enabled);
        setCountdownDate(data.targetDate);
        setCountdownLabel(data.label);
      } catch {
        // Use defaults
      }
    }

    async function fetchNotifications() {
      try {
        const res = await fetch("/api/admin/notifications/settings");
        if (res.ok) {
          const data = await res.json();
          setNotifEnabled(data.enabled);
          setNotifSmtpUrl(data.smtpUrl);
          setNotifBroadcastUrls(data.broadcastUrls);
          setNotifReminderDay(data.reminderDay);
          setNotifReminderTime(data.reminderTime);
          setNotifLookAheadDays(data.lookAheadDays);
          setNotifLastSent(data.lastReminderSent);
          setNotifAppriseHealthy(data.appriseHealthy);
        }
      } catch {
        // Use defaults
      }
    }

    async function fetchSound() {
      try {
        const res = await fetch("/api/sound", { method: "HEAD" });
        setSoundPath(res.ok ? "configured" : "");
      } catch {
        // No sound configured
      }
    }

    async function fetchCleanupSound() {
      try {
        const res = await fetch("/api/cleanup-sound", { method: "HEAD" });
        setCleanupSoundPath(res.ok ? "configured" : "");
      } catch {
        // No sound configured
      }
    }

    fetchBranding();
    fetchCountdown();
    fetchNotifications();
    fetchSound();
    fetchCleanupSound();
  }, []);

  function showMessage(msg: string) {
    setMessage(msg);
    setError("");
    setTimeout(() => setMessage(""), 3000);
  }

  function showError(msg: string) {
    setError(msg);
    setMessage("");
    setTimeout(() => setError(""), 5000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      showError("New passwords do not match");
      return;
    }

    if (newPassword.length < 4) {
      showError("Password must be at least 4 characters");
      return;
    }

    setLoading("password");

    try {
      const verifyRes = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: currentPassword }),
      });

      if (!verifyRes.ok) {
        showError("Current password is incorrect");
        return;
      }

      const res = await fetch("/api/admin/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) throw new Error("Failed to update password");

      showMessage("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      showError("Failed to update password");
    } finally {
      setLoading("");
    }
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setLoading("branding");

    try {
      const res = await fetch("/api/admin/settings/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName,
          appTitle,
          colorPrimary,
          colorPrimaryDark,
          colorPrimaryLight,
          colorNavy,
          colorNavyDark,
          colorAccentBg,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to save branding");
        return;
      }

      showMessage("Branding saved!");
    } catch {
      showError("Failed to save branding");
    } finally {
      setLoading("");
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading("logo");

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to upload logo");
        return;
      }

      showMessage("Logo uploaded!");
      const brandingRes = await fetch("/api/branding");
      const brandingData: Branding = await brandingRes.json();
      setBranding(brandingData);
    } catch {
      showError("Failed to upload logo");
    } finally {
      setLoading("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    setLoading("logo");

    try {
      const res = await fetch("/api/admin/settings/logo", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove logo");

      showMessage("Logo removed!");
      setBranding((prev) => prev ? { ...prev, logoPath: "" } : prev);
    } catch {
      showError("Failed to remove logo");
    } finally {
      setLoading("");
    }
  }

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading("favicon");

    try {
      const formData = new FormData();
      formData.append("favicon", file);

      const res = await fetch("/api/admin/settings/favicon", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to upload favicon");
        return;
      }

      showMessage("Favicon uploaded!");
      const brandingRes = await fetch("/api/branding");
      const brandingData: Branding = await brandingRes.json();
      setBranding(brandingData);
    } catch {
      showError("Failed to upload favicon");
    } finally {
      setLoading("");
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    }
  }

  async function handleRemoveFavicon() {
    setLoading("favicon");

    try {
      const res = await fetch("/api/admin/settings/favicon", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove favicon");

      showMessage("Favicon removed!");
      setBranding((prev) => prev ? { ...prev, faviconPath: "" } : prev);
    } catch {
      showError("Failed to remove favicon");
    } finally {
      setLoading("");
    }
  }

  async function handleSoundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading("sound");

    try {
      const formData = new FormData();
      formData.append("sound", file);

      const res = await fetch("/api/admin/settings/sound", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to upload sound");
        return;
      }

      showMessage("Shift change sound uploaded!");
      setSoundPath("configured");
    } catch {
      showError("Failed to upload sound");
    } finally {
      setLoading("");
      if (soundInputRef.current) soundInputRef.current.value = "";
    }
  }

  async function handleRemoveSound() {
    setLoading("sound");

    try {
      const res = await fetch("/api/admin/settings/sound", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove sound");

      showMessage("Shift change sound removed!");
      setSoundPath("");
    } catch {
      showError("Failed to remove sound");
    } finally {
      setLoading("");
    }
  }

  async function handleCleanupSoundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading("cleanup-sound");

    try {
      const formData = new FormData();
      formData.append("sound", file);

      const res = await fetch("/api/admin/settings/cleanup-sound", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to upload sound");
        return;
      }

      showMessage("Cleanup reminder sound uploaded!");
      setCleanupSoundPath("configured");
    } catch {
      showError("Failed to upload sound");
    } finally {
      setLoading("");
      if (cleanupSoundInputRef.current) cleanupSoundInputRef.current.value = "";
    }
  }

  async function handleRemoveCleanupSound() {
    setLoading("cleanup-sound");

    try {
      const res = await fetch("/api/admin/settings/cleanup-sound", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove sound");

      showMessage("Cleanup reminder sound removed!");
      setCleanupSoundPath("");
    } catch {
      showError("Failed to remove sound");
    } finally {
      setLoading("");
    }
  }

  function handleResetColors() {
    setColorPrimary("#51077a");
    setColorPrimaryDark("#3b0559");
    setColorPrimaryLight("#c084fc");
    setColorNavy("#2d3748");
    setColorNavyDark("#1a202c");
    setColorAccentBg("#f3e8ff");
  }

  async function handleSaveNotifications(e: React.FormEvent) {
    e.preventDefault();
    setLoading("notifications");

    try {
      const res = await fetch("/api/admin/notifications/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: notifEnabled,
          smtpUrl: notifSmtpUrl,
          broadcastUrls: notifBroadcastUrls,
          reminderDay: notifReminderDay,
          reminderTime: notifReminderTime,
          lookAheadDays: notifLookAheadDays,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to save notification settings");
        return;
      }

      showMessage("Notification settings saved!");
    } catch {
      showError("Failed to save notification settings");
    } finally {
      setLoading("");
    }
  }

  async function handleSendTest() {
    setLoading("notif-test");

    try {
      const res = await fetch("/api/admin/notifications/test", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Test notification failed");
        return;
      }

      showMessage("Test notification sent!");
    } catch {
      showError("Failed to send test notification");
    } finally {
      setLoading("");
    }
  }

  async function handlePreviewReminders() {
    setLoading("notif-preview");

    try {
      const res = await fetch("/api/admin/notifications/preview");
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Failed to load preview");
        return;
      }

      setNotifPreview(data);
    } catch {
      showError("Failed to load preview");
    } finally {
      setLoading("");
    }
  }

  async function handleSendReminders() {
    setLoading("notif-send");

    try {
      const res = await fetch("/api/admin/notifications/send-reminders", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Failed to send reminders");
        return;
      }

      const parts = [];
      if (data.mentorsSent > 0) parts.push(`${data.mentorsSent} mentor email(s) sent`);
      if (data.broadcastSent) parts.push("broadcast sent");
      if (data.errors?.length > 0) parts.push(`${data.errors.length} error(s)`);

      showMessage(parts.length > 0 ? `Reminders sent: ${parts.join(", ")}` : "No reminders to send");
      setNotifLastSent(new Date().toISOString());
      setNotifPreview(null);
    } catch {
      showError("Failed to send reminders");
    } finally {
      setLoading("");
    }
  }

  async function handleSendTestEmail() {
    if (!testEmail || !testEmail.includes("@")) {
      showError("Please enter a valid email address");
      return;
    }

    setLoading("notif-test-email");

    try {
      const res = await fetch("/api/admin/notifications/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Test email failed");
        return;
      }

      showMessage(`Test reminder sent to ${testEmail}!`);
      setShowTestEmail(false);
    } catch {
      showError("Failed to send test email");
    } finally {
      setLoading("");
    }
  }

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  async function handleSaveCountdown(e: React.FormEvent) {
    e.preventDefault();
    setLoading("countdown");

    try {
      const res = await fetch("/api/admin/settings/countdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: countdownEnabled,
          targetDate: countdownDate,
          label: countdownLabel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to save countdown");
        return;
      }

      showMessage("Countdown settings saved!");
    } catch {
      showError("Failed to save countdown");
    } finally {
      setLoading("");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 max-w-2xl">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 max-w-2xl">
          {error}
        </div>
      )}

      <div className="space-y-8 max-w-2xl">
        {/* App Name & Title */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">App Name & Title</h2>
          <form onSubmit={handleSaveBranding} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                App Name
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="FRC Workshop Signup"
              />
              <p className="text-xs text-slate-500 mt-1">
                Shown in the navigation bar and pages
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Browser Tab Title
              </label>
              <input
                type="text"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="FRC Workshop Signup"
              />
              <p className="text-xs text-slate-500 mt-1">
                Shown in the browser tab
              </p>
            </div>

            {/* Colors */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Theme Colors</h3>
                <button
                  type="button"
                  onClick={handleResetColors}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Reset to defaults
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Accent is used on buttons &amp; links. Light accent is used for text on dark backgrounds. Background tint is used for highlights on light pages.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Accent
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorPrimary}
                      onChange={(e) => setColorPrimary(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={colorPrimary}
                      onChange={(e) => setColorPrimary(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                      pattern="^#[0-9a-fA-F]{6}$"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Accent Dark (hover)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorPrimaryDark}
                      onChange={(e) => setColorPrimaryDark(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={colorPrimaryDark}
                      onChange={(e) => setColorPrimaryDark(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                      pattern="^#[0-9a-fA-F]{6}$"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Light Accent (on dark)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorPrimaryLight}
                      onChange={(e) => setColorPrimaryLight(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={colorPrimaryLight}
                      onChange={(e) => setColorPrimaryLight(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                      pattern="^#[0-9a-fA-F]{6}$"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Background Tint
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorAccentBg}
                      onChange={(e) => setColorAccentBg(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={colorAccentBg}
                      onChange={(e) => setColorAccentBg(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                      pattern="^#[0-9a-fA-F]{6}$"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Dark Background
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorNavy}
                      onChange={(e) => setColorNavy(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={colorNavy}
                      onChange={(e) => setColorNavy(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                      pattern="^#[0-9a-fA-F]{6}$"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Darkest Background
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorNavyDark}
                      onChange={(e) => setColorNavyDark(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={colorNavyDark}
                      onChange={(e) => setColorNavyDark(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                      pattern="^#[0-9a-fA-F]{6}$"
                    />
                  </div>
                </div>
              </div>

              {/* Color Preview */}
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Preview</p>
                <div className="flex gap-2 mb-2">
                  <div className="flex-1 rounded overflow-hidden">
                    <div
                      className="h-8 flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: colorPrimary }}
                    >
                      Accent
                    </div>
                  </div>
                  <div className="flex-1 rounded overflow-hidden">
                    <div
                      className="h-8 flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: colorPrimaryDark }}
                    >
                      Hover
                    </div>
                  </div>
                  <div className="flex-1 rounded overflow-hidden">
                    <div
                      className="h-8 flex items-center justify-center text-xs font-medium"
                      style={{ backgroundColor: colorNavy, color: colorPrimaryLight }}
                    >
                      Light on Dark
                    </div>
                  </div>
                  <div className="flex-1 rounded overflow-hidden">
                    <div
                      className="h-8 flex items-center justify-center text-xs font-medium"
                      style={{ backgroundColor: colorAccentBg, color: colorPrimary }}
                    >
                      On Tint
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded overflow-hidden">
                    <div
                      className="h-8 flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: colorNavy }}
                    >
                      Dark BG
                    </div>
                  </div>
                  <div className="flex-1 rounded overflow-hidden">
                    <div
                      className="h-8 flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: colorNavyDark }}
                    >
                      Darkest BG
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading === "branding"}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
            >
              {loading === "branding" ? "Saving..." : "Save Branding"}
            </button>
          </form>
        </div>

        {/* Logo Upload */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Logo</h2>

          {branding?.logoPath ? (
            <div className="mb-4">
              <div className="flex items-center gap-4">
                <img
                  src={`/api/logo?t=${Date.now()}`}
                  alt="Current logo"
                  className="h-16 w-auto border border-slate-200 rounded-lg p-2"
                />
                <div>
                  <p className="text-sm text-slate-600">Current logo</p>
                  <button
                    onClick={handleRemoveLogo}
                    disabled={loading === "logo"}
                    className="text-red-600 hover:text-red-700 text-sm underline mt-1"
                  >
                    {loading === "logo" ? "Removing..." : "Remove logo"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              No logo uploaded. The app name will be shown as text.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Upload Logo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
              onChange={handleLogoUpload}
              disabled={loading === "logo"}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              PNG, JPG, GIF, SVG, or WebP. Max 2MB.
            </p>
          </div>
        </div>

        {/* Favicon Upload */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Favicon</h2>

          {branding?.faviconPath ? (
            <div className="mb-4">
              <div className="flex items-center gap-4">
                <img
                  src={`/api/favicon?t=${Date.now()}`}
                  alt="Current favicon"
                  className="h-8 w-8 border border-slate-200 rounded p-1"
                />
                <div>
                  <p className="text-sm text-slate-600">Current favicon</p>
                  <button
                    onClick={handleRemoveFavicon}
                    disabled={loading === "favicon"}
                    className="text-red-600 hover:text-red-700 text-sm underline mt-1"
                  >
                    {loading === "favicon" ? "Removing..." : "Remove favicon"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              No custom favicon uploaded. The default icon will be used.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Upload Favicon
            </label>
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp"
              onChange={handleFaviconUpload}
              disabled={loading === "favicon"}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              PNG, ICO, SVG, or WebP. Max 1MB. Square images work best (e.g. 32x32 or 64x64).
            </p>
          </div>
        </div>

        {/* Shift Change Sound */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Shift Change Sound</h2>
          <p className="text-sm text-slate-600 mb-4">
            Upload a sound that plays on the dashboard when a shift change occurs. Plays at low volume.
          </p>

          {soundPath ? (
            <div className="mb-4">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 rounded-lg px-4 py-3">
                  <span className="text-sm text-slate-600">Sound uploaded</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const audio = new Audio("/api/sound");
                      audio.volume = 0.3;
                      audio.play().catch(() => {});
                    }}
                    className="text-primary hover:text-primary-dark text-sm underline"
                  >
                    Preview
                  </button>
                  <button
                    onClick={handleRemoveSound}
                    disabled={loading === "sound"}
                    className="text-red-600 hover:text-red-700 text-sm underline"
                  >
                    {loading === "sound" ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              No sound uploaded. The dashboard will be silent on shift changes.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Upload Sound
            </label>
            <input
              ref={soundInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
              onChange={handleSoundUpload}
              disabled={loading === "sound"}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              MP3, WAV, OGG, or WebM. Max 5MB. Short sounds work best.
            </p>
          </div>
        </div>

        {/* Cleanup Reminder Sound */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Cleanup Reminder Sound</h2>
          <p className="text-sm text-slate-600 mb-4">
            Plays 20 minutes before the last shift of the day ends. A 10-minute cleanup countdown will also appear on the dashboard.
          </p>

          {cleanupSoundPath ? (
            <div className="mb-4">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 rounded-lg px-4 py-3">
                  <span className="text-sm text-slate-600">Sound uploaded</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const audio = new Audio("/api/cleanup-sound");
                      audio.volume = 0.3;
                      audio.play().catch(() => {});
                    }}
                    className="text-primary hover:text-primary-dark text-sm underline"
                  >
                    Preview
                  </button>
                  <button
                    onClick={handleRemoveCleanupSound}
                    disabled={loading === "cleanup-sound"}
                    className="text-red-600 hover:text-red-700 text-sm underline"
                  >
                    {loading === "cleanup-sound" ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              No sound uploaded. The cleanup countdown will still appear but no sound will play.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Upload Sound
            </label>
            <input
              ref={cleanupSoundInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
              onChange={handleCleanupSoundUpload}
              disabled={loading === "cleanup-sound"}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              MP3, WAV, OGG, or WebM. Max 5MB.
            </p>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Dashboard Countdown Timer</h2>
          <p className="text-sm text-slate-600 mb-4">
            Display a countdown timer on the public dashboard (e.g., days until competition)
          </p>

          <form onSubmit={handleSaveCountdown} className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="countdown-enabled"
                checked={countdownEnabled}
                onChange={(e) => setCountdownEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="countdown-enabled" className="text-sm font-medium">
                Enable countdown timer
              </label>
            </div>

            {countdownEnabled && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Event Label
                  </label>
                  <input
                    type="text"
                    required
                    value={countdownLabel}
                    onChange={(e) => setCountdownLabel(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="e.g., Competition Day, Season Start"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    required
                    value={countdownDate}
                    onChange={(e) => setCountdownDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading === "countdown"}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
            >
              {loading === "countdown" ? "Saving..." : "Save Countdown Settings"}
            </button>
          </form>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Notifications</h2>
            {notifAppriseHealthy !== null && (
              <span className={`text-xs px-2 py-1 rounded-full ${notifAppriseHealthy ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                Apprise {notifAppriseHealthy ? "connected" : "unreachable"}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Send weekly email reminders to mentors who haven&apos;t signed up for upcoming shifts.
          </p>

          <form onSubmit={handleSaveNotifications} className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notif-enabled"
                checked={notifEnabled}
                onChange={(e) => setNotifEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="notif-enabled" className="text-sm font-medium">
                Enable notifications
              </label>
            </div>

            {notifEnabled && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    SMTP URL
                  </label>
                  <input
                    type="password"
                    value={notifSmtpUrl}
                    onChange={(e) => setNotifSmtpUrl(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm"
                    placeholder="mailto://user:pass@smtp.gmail.com"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Apprise mailto URL for sending individual mentor emails. Leave blank to skip email notifications.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Broadcast URLs
                  </label>
                  <textarea
                    value={notifBroadcastUrls}
                    onChange={(e) => setNotifBroadcastUrls(e.target.value)}
                    rows={3}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm"
                    placeholder={"slack://token@channel\ndiscord://webhook_id/webhook_token"}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    One Apprise URL per line. Summary notifications go here (Slack, Discord, etc.)
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Reminder Day
                    </label>
                    <select
                      value={notifReminderDay}
                      onChange={(e) => setNotifReminderDay(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      {DAY_NAMES.map((name, i) => (
                        <option key={i} value={String(i)}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Reminder Time
                    </label>
                    <input
                      type="time"
                      value={notifReminderTime}
                      onChange={(e) => setNotifReminderTime(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Look-ahead Days
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={notifLookAheadDays}
                      onChange={(e) => setNotifLookAheadDays(parseInt(e.target.value) || 7)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {notifLastSent && (
                  <p className="text-xs text-slate-500">
                    Last reminder sent: {new Date(notifLastSent).toLocaleString()}
                  </p>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={loading === "notifications"}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
              >
                {loading === "notifications" ? "Saving..." : "Save Settings"}
              </button>

              {notifEnabled && (
                <>
                  <button
                    type="button"
                    onClick={handleSendTest}
                    disabled={loading === "notif-test"}
                    className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm"
                  >
                    {loading === "notif-test" ? "Sending..." : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTestEmail(!showTestEmail)}
                    className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors text-sm"
                  >
                    Send Test to Me
                  </button>
                  <button
                    type="button"
                    onClick={handlePreviewReminders}
                    disabled={loading === "notif-preview"}
                    className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm"
                  >
                    {loading === "notif-preview" ? "Loading..." : "Preview"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendReminders}
                    disabled={loading === "notif-send"}
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 text-sm"
                  >
                    {loading === "notif-send" ? "Sending..." : "Send Reminders Now"}
                  </button>
                </>
              )}
            </div>

            {showTestEmail && notifEnabled && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <label className="block text-sm font-medium mb-1">
                  Send a test reminder email to:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={loading === "notif-test-email"}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    {loading === "notif-test-email" ? "Sending..." : "Send"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Sends a realistic reminder email to just this address (not to mentors).
                </p>
              </div>
            )}
          </form>

          {notifPreview && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold mb-2">
                Preview — {notifPreview.mentors.length} mentor(s) would be notified
              </h3>

              {notifPreview.mentors.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-1">Mentors without signups in the next {notifPreview.lookAheadDays} days:</p>
                  <ul className="text-sm space-y-1">
                    {notifPreview.mentors.map((m) => (
                      <li key={m.id} className="text-slate-700">
                        {m.name} <span className="text-slate-400">({m.email})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-green-600 mb-3">All mentors have signed up for upcoming shifts!</p>
              )}

              {notifPreview.upcomingShifts.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Upcoming shifts:</p>
                  {Object.entries(
                    notifPreview.upcomingShifts.reduce<Record<string, typeof notifPreview.upcomingShifts>>((acc, s) => {
                      (acc[s.date] ??= []).push(s);
                      return acc;
                    }, {})
                  ).map(([date, shifts]) => (
                    <div key={date} className="mb-2">
                      <p className="text-sm font-medium text-slate-800">{date}</p>
                      <ul className="text-sm space-y-1 ml-2">
                        {shifts.map((s) => (
                          <li key={s.id} className={s.signupCount < 2 ? "text-amber-700 font-medium" : "text-slate-700"}>
                            {s.startTime}–{s.endTime}
                            {s.label ? ` (${s.label})` : ""} — {s.signupCount} signed up
                            {s.signupCount < 2 && " \u26A0\uFE0F Needs mentors!"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Change Admin Password</h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={loading === "password"}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
            >
              {loading === "password" ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
