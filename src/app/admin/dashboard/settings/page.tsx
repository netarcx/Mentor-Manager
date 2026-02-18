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
  appleIconPath: string;
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
  const appleIconInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const cleanupSoundInputRef = useRef<HTMLInputElement>(null);
  const slideshowInputRef = useRef<HTMLInputElement>(null);
  const [soundPath, setSoundPath] = useState("");
  const [cleanupSoundPath, setCleanupSoundPath] = useState("");
  const [cleanupSoundMinutes, setCleanupSoundMinutes] = useState(20);
  const [cleanupDisplayMinutes, setCleanupDisplayMinutes] = useState(10);
  const [cleanupTestActive, setCleanupTestActive] = useState(false);
  const [soundVolume, setSoundVolume] = useState(0.5);

  // Slideshow state
  const [slideshowImages, setSlideshowImages] = useState<{ id: number; filename: string; sortOrder: number }[]>([]);
  const [slideshowInterval, setSlideshowInterval] = useState(8);
  const [slideshowEnabled, setSlideshowEnabled] = useState(true);

  // Registration state
  const [registrationOpen, setRegistrationOpen] = useState(true);

  // Goals state
  const [goalsEnabled, setGoalsEnabled] = useState(true);

  // Announcement state
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");

  // Digest state
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestFrequency, setDigestFrequency] = useState("weekly");
  const [digestDay, setDigestDay] = useState("1");
  const [digestTime, setDigestTime] = useState("09:00");
  const [digestLastSent, setDigestLastSent] = useState("");

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

    async function fetchCleanupSettings() {
      try {
        const res = await fetch("/api/admin/settings/cleanup");
        if (res.ok) {
          const data = await res.json();
          setCleanupSoundMinutes(data.soundMinutes);
          setCleanupDisplayMinutes(data.displayMinutes);
          if (data.soundVolume !== undefined) setSoundVolume(data.soundVolume);
        }
      } catch {
        // Use defaults
      }
    }

    async function fetchRegistration() {
      try {
        const res = await fetch("/api/shifts");
        const data = await res.json();
        if (data.registrationOpen !== undefined) setRegistrationOpen(data.registrationOpen);
      } catch {
        // Use default
      }
    }

    async function fetchGoals() {
      try {
        const res = await fetch("/api/admin/settings/goals");
        if (res.ok) {
          const data = await res.json();
          setGoalsEnabled(data.enabled);
        }
      } catch {
        // Use defaults
      }
    }

    async function fetchAnnouncement() {
      try {
        const res = await fetch("/api/admin/settings/announcement");
        if (res.ok) {
          const data = await res.json();
          setAnnouncementEnabled(data.enabled);
          setAnnouncementText(data.text);
        }
      } catch {
        // Use defaults
      }
    }

    async function fetchDigestSettings() {
      try {
        const res = await fetch("/api/admin/notifications/digest-settings");
        if (res.ok) {
          const data = await res.json();
          setDigestEnabled(data.enabled);
          setDigestFrequency(data.frequency);
          setDigestDay(data.day);
          setDigestTime(data.time);
          setDigestLastSent(data.lastSent);
        }
      } catch {
        // Use defaults
      }
    }

    async function fetchSlideshow() {
      try {
        const res = await fetch("/api/admin/slideshow");
        if (res.ok) {
          const data = await res.json();
          setSlideshowImages(data.images || []);
        }
      } catch { /* use defaults */ }
    }

    async function fetchSlideshowSettings() {
      try {
        const res = await fetch("/api/admin/settings/slideshow");
        if (res.ok) {
          const data = await res.json();
          setSlideshowInterval(data.interval);
          setSlideshowEnabled(data.enabled);
        }
      } catch { /* use defaults */ }
    }

    fetchSlideshow();
    fetchSlideshowSettings();
    fetchRegistration();
    fetchBranding();
    fetchCountdown();
    fetchNotifications();
    fetchSound();
    fetchCleanupSound();
    fetchCleanupSettings();
    fetchGoals();
    fetchAnnouncement();
    fetchDigestSettings();
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

  async function handleAppleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading("apple-icon");

    try {
      const formData = new FormData();
      formData.append("apple-icon", file);

      const res = await fetch("/api/admin/settings/apple-icon", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to upload icon");
        return;
      }

      showMessage("Home screen icon uploaded!");
      const brandingRes = await fetch("/api/branding");
      const brandingData: Branding = await brandingRes.json();
      setBranding(brandingData);
    } catch {
      showError("Failed to upload icon");
    } finally {
      setLoading("");
      if (appleIconInputRef.current) appleIconInputRef.current.value = "";
    }
  }

  async function handleRemoveAppleIcon() {
    setLoading("apple-icon");

    try {
      const res = await fetch("/api/admin/settings/apple-icon", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove icon");

      showMessage("Home screen icon removed!");
      setBranding((prev) => prev ? { ...prev, appleIconPath: "" } : prev);
    } catch {
      showError("Failed to remove icon");
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

  async function handleSaveCleanupSettings(e: React.FormEvent) {
    e.preventDefault();
    setLoading("cleanup-settings");

    try {
      const res = await fetch("/api/admin/settings/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soundMinutes: cleanupSoundMinutes,
          displayMinutes: cleanupDisplayMinutes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to save cleanup settings");
        return;
      }

      showMessage("Cleanup timing saved!");
    } catch {
      showError("Failed to save cleanup settings");
    } finally {
      setLoading("");
    }
  }

  function handleTestCleanup() {
    setCleanupTestActive(true);
    const audio = new Audio("/api/cleanup-sound");
    audio.volume = soundVolume;
    audio.play().catch(() => {});
    setTimeout(() => setCleanupTestActive(false), 15000);
  }

  async function handleSlideshowUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading("slideshow-upload");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/admin/slideshow", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to upload image");
        return;
      }
      showMessage("Image uploaded!");
      const listRes = await fetch("/api/admin/slideshow");
      if (listRes.ok) setSlideshowImages((await listRes.json()).images);
    } catch {
      showError("Failed to upload image");
    } finally {
      setLoading("");
      if (slideshowInputRef.current) slideshowInputRef.current.value = "";
    }
  }

  async function handleSlideshowDelete(imageId: number) {
    setLoading(`slideshow-delete-${imageId}`);
    try {
      const res = await fetch(`/api/admin/slideshow/${imageId}`, { method: "DELETE" });
      if (!res.ok) { showError("Failed to delete image"); return; }
      setSlideshowImages((prev) => prev.filter((img) => img.id !== imageId));
      showMessage("Image deleted!");
    } catch {
      showError("Failed to delete image");
    } finally {
      setLoading("");
    }
  }

  async function handleSlideshowMove(imageId: number, direction: "up" | "down") {
    const index = slideshowImages.findIndex((img) => img.id === imageId);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slideshowImages.length) return;

    const reordered = [...slideshowImages];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setSlideshowImages(reordered);

    await fetch("/api/admin/slideshow/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((img) => img.id) }),
    });
  }

  async function handleSaveSlideshowSettings() {
    setLoading("slideshow-settings");
    try {
      const res = await fetch("/api/admin/settings/slideshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: slideshowInterval, enabled: slideshowEnabled }),
      });
      if (!res.ok) { showError("Failed to save slideshow settings"); return; }
      showMessage("Slideshow settings saved!");
    } catch {
      showError("Failed to save slideshow settings");
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

  async function handleToggleRegistration() {
    const newValue = !registrationOpen;
    setRegistrationOpen(newValue);

    try {
      const res = await fetch("/api/admin/settings/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationEnabled: newValue }),
      });

      if (!res.ok) {
        setRegistrationOpen(!newValue);
        showError("Failed to update registration setting");
        return;
      }

      showMessage(newValue ? "Registration opened" : "Registration closed");
    } catch {
      setRegistrationOpen(!newValue);
      showError("Failed to update registration setting");
    }
  }

  async function handleToggleGoals() {
    const newValue = !goalsEnabled;
    setGoalsEnabled(newValue);
    try {
      const res = await fetch("/api/admin/settings/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });

      if (!res.ok) {
        setGoalsEnabled(!newValue);
        showError("Failed to update goals setting");
        return;
      }

      showMessage(newValue ? "Goals section enabled" : "Goals section disabled");
    } catch {
      setGoalsEnabled(!newValue);
      showError("Failed to update goals setting");
    }
  }

  async function handleSaveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setLoading("announcement");

    try {
      const res = await fetch("/api/admin/settings/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: announcementEnabled, text: announcementText }),
      });

      if (!res.ok) {
        showError("Failed to save announcement");
        return;
      }

      showMessage("Announcement saved!");
    } catch {
      showError("Failed to save announcement");
    } finally {
      setLoading("");
    }
  }

  async function handleSaveDigest(e: React.FormEvent) {
    e.preventDefault();
    setLoading("digest");

    try {
      const res = await fetch("/api/admin/notifications/digest-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: digestEnabled,
          frequency: digestFrequency,
          day: digestDay,
          time: digestTime,
        }),
      });

      if (!res.ok) {
        showError("Failed to save digest settings");
        return;
      }

      showMessage("Digest settings saved!");
    } catch {
      showError("Failed to save digest settings");
    } finally {
      setLoading("");
    }
  }

  async function handleSendDigestNow() {
    setLoading("digest-send");

    try {
      const res = await fetch("/api/admin/notifications/send-digest", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Failed to send digest");
        return;
      }

      if (data.sent) {
        showMessage("Digest sent!");
        setDigestLastSent(new Date().toISOString());
      } else {
        showError(data.error || "Digest was not sent");
      }
    } catch {
      showError("Failed to send digest");
    } finally {
      setLoading("");
    }
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
        {/* Mentor Registration */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Mentor Registration</h2>
              <p className="text-sm text-slate-500 mt-1">
                {registrationOpen
                  ? "New mentors can register and sign up for shifts."
                  : "Only existing mentors can sign up. New registrations are blocked."}
              </p>
            </div>
            <button
              onClick={handleToggleRegistration}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                registrationOpen ? "bg-green-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  registrationOpen ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Daily Goals */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Daily Goals</h2>
              <p className="text-sm text-slate-500 mt-1">
                {goalsEnabled
                  ? "The goals section is visible on the dashboard."
                  : "The goals section is hidden from the dashboard."}
              </p>
            </div>
            <button
              onClick={handleToggleGoals}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                goalsEnabled ? "bg-green-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  goalsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Announcement Banner */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Announcement Banner</h2>
          <p className="text-sm text-slate-500 mb-4">
            Display a message across the top of the public dashboard.
          </p>

          <form onSubmit={handleSaveAnnouncement} className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="announcement-enabled"
                checked={announcementEnabled}
                onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="announcement-enabled" className="text-sm font-medium">
                Show announcement on dashboard
              </label>
            </div>

            {announcementEnabled && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Announcement Text
                </label>
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="e.g., Pizza night tonight! No meeting Thursday."
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading === "announcement"}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
            >
              {loading === "announcement" ? "Saving..." : "Save Announcement"}
            </button>
          </form>
        </div>

        {/* Dashboard Slideshow */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Dashboard Slideshow</h2>
          <p className="text-sm text-slate-500 mb-4">
            Show a slideshow of images on the dashboard when no shift is active.
          </p>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Enable slideshow</span>
            <button
              onClick={async () => {
                const newEnabled = !slideshowEnabled;
                setSlideshowEnabled(newEnabled);
                try {
                  await fetch("/api/admin/settings/slideshow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ interval: slideshowInterval, enabled: newEnabled }),
                  });
                  showMessage(newEnabled ? "Slideshow enabled" : "Slideshow disabled");
                } catch {
                  setSlideshowEnabled(!newEnabled);
                  showError("Failed to update slideshow");
                }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                slideshowEnabled ? "bg-green-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  slideshowEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Cycle interval (seconds)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="2"
                max="120"
                value={slideshowInterval}
                onChange={(e) => setSlideshowInterval(parseInt(e.target.value) || 8)}
                className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveSlideshowSettings}
                disabled={loading === "slideshow-settings"}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm"
              >
                {loading === "slideshow-settings" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold mb-3">Images ({slideshowImages.length})</h3>
            {slideshowImages.length > 0 ? (
              <div className="space-y-2 mb-4">
                {slideshowImages.map((img, index) => (
                  <div key={img.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-2">
                    <img
                      src={`/api/slideshow/${img.id}`}
                      alt=""
                      className="h-16 w-24 object-cover rounded border border-slate-200"
                    />
                    <span className="text-sm text-slate-600 flex-1">#{index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSlideshowMove(img.id, "up")}
                        disabled={index === 0}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30 px-1"
                      >
                        &uarr;
                      </button>
                      <button
                        onClick={() => handleSlideshowMove(img.id, "down")}
                        disabled={index === slideshowImages.length - 1}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30 px-1"
                      >
                        &darr;
                      </button>
                      <button
                        onClick={() => handleSlideshowDelete(img.id)}
                        disabled={loading === `slideshow-delete-${img.id}`}
                        className="text-red-500 hover:text-red-700 text-sm ml-2"
                      >
                        {loading === `slideshow-delete-${img.id}` ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-4">No slideshow images uploaded.</p>
            )}

            <input
              ref={slideshowInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleSlideshowUpload}
              disabled={loading === "slideshow-upload"}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">PNG, JPEG, GIF, or WebP. Max 5MB per image.</p>
          </div>
        </div>

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

        {/* Home Screen Icon (Apple Touch Icon) */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Home Screen Icon</h2>
          <p className="text-sm text-slate-600 mb-4">
            Shown when someone adds this site to their iPhone or iPad home screen.
            Use a square PNG image, ideally 180x180 pixels.
          </p>

          {branding?.appleIconPath ? (
            <div className="mb-4">
              <div className="flex items-center gap-4">
                <img
                  src={`/api/apple-icon?t=${Date.now()}`}
                  alt="Current home screen icon"
                  className="h-14 w-14 border border-slate-200 rounded-xl"
                />
                <div>
                  <p className="text-sm text-slate-600">Current icon</p>
                  <button
                    onClick={handleRemoveAppleIcon}
                    disabled={loading === "apple-icon"}
                    className="text-red-600 hover:text-red-700 text-sm underline mt-1"
                  >
                    {loading === "apple-icon" ? "Removing..." : "Remove icon"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">
              No icon uploaded. iPhones will use a screenshot of the page instead.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Upload Icon
            </label>
            <input
              ref={appleIconInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAppleIconUpload}
              disabled={loading === "apple-icon"}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              PNG, JPG, or WebP. Max 2MB. Square 180x180px recommended.
            </p>
          </div>
        </div>

        {/* Shift Change Sound */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Shift Change Sound</h2>
          <p className="text-sm text-slate-600 mb-4">
            Upload a sound that plays on the dashboard when a shift change occurs.
          </p>

          {/* Volume Control */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Sound Volume: {Math.round(soundVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundVolume}
              onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Quiet</span>
              <span>Loud</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                setLoading("volume");
                try {
                  const res = await fetch("/api/admin/settings/cleanup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ soundMinutes: cleanupSoundMinutes, displayMinutes: cleanupDisplayMinutes, soundVolume }),
                  });
                  if (res.ok) showMessage("Volume saved!");
                  else showError("Failed to save volume");
                } catch {
                  showError("Failed to save volume");
                } finally {
                  setLoading("");
                }
              }}
              disabled={loading === "volume"}
              className="mt-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm font-semibold"
            >
              {loading === "volume" ? "Saving..." : "Save Volume"}
            </button>
            <p className="text-xs text-slate-500 mt-1">
              Applies to both shift change and cleanup reminder sounds.
            </p>
          </div>

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
                      audio.volume = soundVolume;
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
              accept="audio/*"
              onChange={handleSoundUpload}
              disabled={loading === "sound"}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark file:cursor-pointer disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              MP3, WAV, OGG, or WebM. Max 5MB. Short sounds work best.
            </p>
          </div>
        </div>

        {/* Cleanup Reminder */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Cleanup Reminder</h2>
          <p className="text-sm text-slate-600 mb-4">
            Plays a sound and shows a countdown on the dashboard before the last shift of the day ends.
          </p>

          {/* Timing Settings */}
          <form onSubmit={handleSaveCleanupSettings} className="mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Sound alert (minutes before end)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={cleanupSoundMinutes}
                  onChange={(e) => setCleanupSoundMinutes(parseInt(e.target.value) || 20)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Countdown display (minutes before end)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={cleanupDisplayMinutes}
                  onChange={(e) => setCleanupDisplayMinutes(parseInt(e.target.value) || 10)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading === "cleanup-settings"}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm font-semibold"
              >
                {loading === "cleanup-settings" ? "Saving..." : "Save Timing"}
              </button>
              <button
                type="button"
                onClick={handleTestCleanup}
                disabled={cleanupTestActive}
                className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-semibold"
              >
                {cleanupTestActive ? "Test Active (15s)..." : "Test Cleanup"}
              </button>
            </div>
          </form>

          {/* Test preview */}
          {cleanupTestActive && (
            <div className="bg-amber-500/10 border-2 border-amber-500 rounded-xl p-4 mb-6 text-center animate-pulse">
              <div className="text-amber-600 text-sm font-semibold uppercase tracking-wider mb-1">
                Cleanup Time (Test)
              </div>
              <div className="text-3xl font-bold text-amber-700">
                0:15
              </div>
            </div>
          )}

          {/* Sound Upload */}
          <h3 className="text-sm font-semibold mb-3 text-slate-700">Cleanup Sound</h3>
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
                      audio.volume = soundVolume;
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
              accept="audio/*"
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

        {/* Digest Reports */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Digest Reports</h2>
          <p className="text-sm text-slate-500 mb-4">
            Send periodic attendance and team summary reports to your broadcast channels (Slack, Discord, etc.)
          </p>

          <form onSubmit={handleSaveDigest} className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="digest-enabled"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="digest-enabled" className="text-sm font-medium">
                Enable digest reports
              </label>
            </div>

            {digestEnabled && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Frequency
                    </label>
                    <select
                      value={digestFrequency}
                      onChange={(e) => {
                        setDigestFrequency(e.target.value);
                        setDigestDay(e.target.value === "weekly" ? "1" : "1");
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {digestFrequency === "weekly" ? "Day of Week" : "Day of Month"}
                    </label>
                    {digestFrequency === "weekly" ? (
                      <select
                        value={digestDay}
                        onChange={(e) => setDigestDay(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      >
                        {DAY_NAMES.map((name, i) => (
                          <option key={i} value={String(i)}>{name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={digestDay}
                        onChange={(e) => setDigestDay(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={digestTime}
                      onChange={(e) => setDigestTime(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {digestLastSent && (
                  <p className="text-xs text-slate-500">
                    Last digest sent: {new Date(digestLastSent).toLocaleString()}
                  </p>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={loading === "digest"}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
              >
                {loading === "digest" ? "Saving..." : "Save Settings"}
              </button>

              {digestEnabled && (
                <button
                  type="button"
                  onClick={handleSendDigestNow}
                  disabled={loading === "digest-send"}
                  className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 text-sm"
                >
                  {loading === "digest-send" ? "Sending..." : "Send Now"}
                </button>
              )}
            </div>
          </form>
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
