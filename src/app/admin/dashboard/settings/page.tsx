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
    fetchBranding();
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

      showMessage("Branding saved! Refresh the page to see changes.");
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

      showMessage("Logo uploaded! Refresh the page to see changes.");
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

      showMessage("Logo removed! Refresh the page to see changes.");
      setBranding((prev) => prev ? { ...prev, logoPath: "" } : prev);
    } catch {
      showError("Failed to remove logo");
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
