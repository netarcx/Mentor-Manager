"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Student {
  id: number;
  name: string;
  _count: { attendances: number };
}

interface AttendanceStudent {
  id: number;
  name: string;
  totalCheckIns: number;
  totalHours: number;
  attendanceRate: number;
}

interface Season {
  id: number;
  name: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [newName, setNewName] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [attendanceStudents, setAttendanceStudents] = useState<AttendanceStudent[]>([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalDays: 0, totalHours: 0, avgAttendanceRate: 0 });
  const [attendanceEnabled, setAttendanceEnabled] = useState(false);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // PIN state
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [captainPin, setCaptainPin] = useState("");
  const [captainPinInput, setCaptainPinInput] = useState("");

  // Subteams state
  const [subteams, setSubteams] = useState<string[]>([]);
  const [newSubteam, setNewSubteam] = useState("");

  // Sheets sync state
  const [syncStatus, setSyncStatus] = useState("");
  const [sheetsReadEnabled, setSheetsReadEnabled] = useState(true);
  const [sheetsWriteEnabled, setSheetsWriteEnabled] = useState(true);
  const [sheetsSyncInterval, setSheetsSyncInterval] = useState(60);
  const [sheetsLastSynced, setSheetsLastSynced] = useState<string | null>(null);
  const [sheetsLastImported, setSheetsLastImported] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
    fetchSeasons();
    fetchAttendance();
    fetchSettings();
    fetchPin();
    fetchSubteams();
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

  async function fetchStudents() {
    try {
      const res = await fetch("/api/admin/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch {
      // Silent fail
    }
  }

  async function fetchSeasons() {
    try {
      const res = await fetch("/api/admin/seasons");
      if (res.ok) {
        const data = await res.json();
        setSeasons(data.seasons || []);
      }
    } catch {
      // Silent fail
    }
  }

  async function fetchAttendance(seasonId?: string) {
    try {
      const url = seasonId
        ? `/api/admin/student-attendance?seasonId=${seasonId}`
        : "/api/admin/student-attendance";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAttendanceStudents(data.students || []);
        setStats(data.stats || { totalStudents: 0, totalDays: 0, avgAttendanceRate: 0 });
      }
    } catch {
      // Silent fail
    }
  }

  async function fetchPin() {
    try {
      const res = await fetch("/api/admin/students/pin");
      if (res.ok) {
        const data = await res.json();
        setPin(data.pin || "");
        setPinInput(data.pin || "");
        setCaptainPin(data.captainPin || "");
        setCaptainPinInput(data.captainPin || "");
      }
    } catch {
      // Silent fail
    }
  }

  async function fetchSubteams() {
    try {
      const res = await fetch("/api/admin/students/subteams");
      if (res.ok) {
        const data = await res.json();
        setSubteams(data.subteams || []);
      }
    } catch {
      // Silent fail
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setLoading("add");
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to add student");
        return;
      }

      showMessage("Student added!");
      setNewName("");
      fetchStudents();
      fetchAttendance(selectedSeason || undefined);
    } catch {
      showError("Failed to add student");
    } finally {
      setLoading("");
    }
  }

  async function handleDeleteStudent(id: number, name: string) {
    if (!confirm(`Remove "${name}" and all their attendance records?`)) return;

    setLoading(`delete-${id}`);
    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        showError("Failed to remove student");
        return;
      }

      showMessage("Student removed");
      fetchStudents();
      fetchAttendance(selectedSeason || undefined);
    } catch {
      showError("Failed to remove student");
    } finally {
      setLoading("");
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch("/api/admin/students/settings");
      if (res.ok) {
        const data = await res.json();
        setAttendanceEnabled(data.enabled);
        setSheetsReadEnabled(data.sheetsReadEnabled);
        setSheetsWriteEnabled(data.sheetsWriteEnabled);
        setSheetsSyncInterval(data.sheetsSyncInterval);
        setSheetsLastSynced(data.sheetsLastSynced);
        setSheetsLastImported(data.sheetsLastImported);
      }
    } catch {
      // Use defaults
    }
  }

  async function handleToggleAttendance() {
    const newValue = !attendanceEnabled;
    setAttendanceEnabled(newValue);

    try {
      const res = await fetch("/api/admin/students/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });

      if (!res.ok) {
        setAttendanceEnabled(!newValue);
        showError("Failed to update setting");
        return;
      }

      showMessage(newValue ? "Student check-in enabled" : "Student check-in disabled");
    } catch {
      setAttendanceEnabled(!newValue);
      showError("Failed to update setting");
    }
  }

  async function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    setLoading("pin");
    try {
      const res = await fetch("/api/admin/students/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to save PIN");
        return;
      }

      setPin(pinInput);
      showMessage(pinInput ? "Mentor PIN saved!" : "Mentor PIN removed");
    } catch {
      showError("Failed to save PIN");
    } finally {
      setLoading("");
    }
  }

  async function handleSaveCaptainPin(e: React.FormEvent) {
    e.preventDefault();
    setLoading("captain-pin");
    try {
      const res = await fetch("/api/admin/students/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captainPin: captainPinInput }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to save captain PIN");
        return;
      }

      setCaptainPin(captainPinInput);
      showMessage(captainPinInput ? "Captain PIN saved!" : "Captain PIN removed");
    } catch {
      showError("Failed to save captain PIN");
    } finally {
      setLoading("");
    }
  }

  async function handleAddSubteam(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubteam.trim()) return;
    const updated = [...subteams, newSubteam.trim()];
    setLoading("subteam");
    try {
      const res = await fetch("/api/admin/students/subteams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subteams: updated }),
      });
      if (!res.ok) {
        showError("Failed to save subteams");
        return;
      }
      setSubteams(updated);
      setNewSubteam("");
      showMessage("Subteam added!");
    } catch {
      showError("Failed to save subteams");
    } finally {
      setLoading("");
    }
  }

  async function handleRemoveSubteam(team: string) {
    const updated = subteams.filter((s) => s !== team);
    try {
      const res = await fetch("/api/admin/students/subteams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subteams: updated }),
      });
      if (res.ok) {
        setSubteams(updated);
        showMessage("Subteam removed");
      }
    } catch {
      showError("Failed to remove subteam");
    }
  }

  async function handleSyncSheets() {
    setLoading("sync");
    setSyncStatus("");
    try {
      const res = await fetch("/api/admin/student-attendance/sync-sheets", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        const parts = [];
        if (data.exported > 0) parts.push(`${data.exported} exported`);
        if (data.imported > 0) parts.push(`${data.imported} imported`);
        if (data.studentsCreated > 0) parts.push(`${data.studentsCreated} new students`);
        setSyncStatus(parts.length > 0 ? parts.join(", ") : "Already in sync");
        showMessage("Google Sheets sync complete!");
        fetchSettings();
        fetchStudents();
        fetchAttendance(selectedSeason || undefined);
      } else {
        showError(data.error || "Sync failed");
      }
    } catch {
      showError("Failed to sync to Google Sheets");
    } finally {
      setLoading("");
    }
  }

  async function handleToggleReadEnabled() {
    const newValue = !sheetsReadEnabled;
    setSheetsReadEnabled(newValue);
    try {
      const res = await fetch("/api/admin/students/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetsReadEnabled: newValue }),
      });
      if (!res.ok) {
        setSheetsReadEnabled(!newValue);
        showError("Failed to update setting");
        return;
      }
      showMessage(newValue ? "Read from Sheets enabled" : "Read from Sheets disabled");
    } catch {
      setSheetsReadEnabled(!newValue);
      showError("Failed to update setting");
    }
  }

  async function handleToggleWriteEnabled() {
    const newValue = !sheetsWriteEnabled;
    setSheetsWriteEnabled(newValue);
    try {
      const res = await fetch("/api/admin/students/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetsWriteEnabled: newValue }),
      });
      if (!res.ok) {
        setSheetsWriteEnabled(!newValue);
        showError("Failed to update setting");
        return;
      }
      showMessage(newValue ? "Write to Sheets enabled" : "Write to Sheets disabled");
    } catch {
      setSheetsWriteEnabled(!newValue);
      showError("Failed to update setting");
    }
  }

  async function handleSyncIntervalChange(value: string) {
    const interval = parseInt(value, 10);
    setSheetsSyncInterval(interval);
    try {
      const res = await fetch("/api/admin/students/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetsSyncInterval: interval }),
      });
      if (!res.ok) {
        showError("Failed to update sync interval");
        return;
      }
      showMessage(`Sync interval set to ${value} minutes`);
    } catch {
      showError("Failed to update sync interval");
    }
  }

  function handleSeasonChange(value: string) {
    setSelectedSeason(value);
    fetchAttendance(value || undefined);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Students</h1>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Student Check-in Toggle */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Student Check-In Page</h2>
              <p className="text-sm text-slate-500 mt-1">
                {attendanceEnabled
                  ? <>Active at <span className="font-mono">/student</span></>
                  : "Students will see a \"not available\" message when disabled."}
              </p>
            </div>
            <button
              onClick={handleToggleAttendance}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                attendanceEnabled ? "bg-green-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  attendanceEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Kiosk PINs */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Kiosk PIN Codes</h2>
          <p className="text-sm text-slate-500 mb-4">
            {pin || captainPin
              ? "A PIN is required to unlock the check-in kiosk. Either the mentor or team captain PIN will work. The kiosk auto-locks 20 minutes after the last shift ends."
              : "No PINs set — the check-in kiosk is open to anyone with the link."}
          </p>

          {/* Mentor PIN */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Mentor PIN</label>
            <form onSubmit={handleSavePin} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="4-6 digit PIN"
                className="w-40 border border-slate-300 rounded-lg px-3 py-2 text-center font-mono text-lg tracking-widest"
              />
              <button
                type="submit"
                disabled={loading === "pin"}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm font-semibold"
              >
                {loading === "pin" ? "Saving..." : "Save"}
              </button>
              {pin && (
                <button
                  type="button"
                  onClick={async () => {
                    setLoading("pin");
                    try {
                      const res = await fetch("/api/admin/students/pin", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pin: "" }),
                      });
                      if (res.ok) {
                        setPin("");
                        setPinInput("");
                        showMessage("Mentor PIN removed");
                      } else {
                        showError("Failed to remove PIN");
                      }
                    } catch {
                      showError("Failed to remove PIN");
                    } finally {
                      setLoading("");
                    }
                  }}
                  disabled={loading === "pin"}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              )}
            </form>
          </div>

          {/* Team Captain PIN */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Team Captain PIN</label>
            <form onSubmit={handleSaveCaptainPin} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={captainPinInput}
                onChange={(e) => setCaptainPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="4-6 digit PIN"
                className="w-40 border border-slate-300 rounded-lg px-3 py-2 text-center font-mono text-lg tracking-widest"
              />
              <button
                type="submit"
                disabled={loading === "captain-pin"}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm font-semibold"
              >
                {loading === "captain-pin" ? "Saving..." : "Save"}
              </button>
              {captainPin && (
                <button
                  type="button"
                  onClick={async () => {
                    setLoading("captain-pin");
                    try {
                      const res = await fetch("/api/admin/students/pin", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ captainPin: "" }),
                      });
                      if (res.ok) {
                        setCaptainPin("");
                        setCaptainPinInput("");
                        showMessage("Captain PIN removed");
                      } else {
                        showError("Failed to remove captain PIN");
                      }
                    } catch {
                      showError("Failed to remove captain PIN");
                    } finally {
                      setLoading("");
                    }
                  }}
                  disabled={loading === "captain-pin"}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Subteams */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Subteams</h2>
          <p className="text-sm text-slate-500 mb-4">
            Students select a subteam when clocking out. This is synced to Google Sheets.
          </p>

          {subteams.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {subteams.map((team) => (
                <span
                  key={team}
                  className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full text-sm"
                >
                  {team}
                  <button
                    onClick={() => handleRemoveSubteam(team)}
                    className="text-slate-400 hover:text-red-500 ml-1"
                    title="Remove"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          <form onSubmit={handleAddSubteam} className="flex gap-2">
            <input
              type="text"
              value={newSubteam}
              onChange={(e) => setNewSubteam(e.target.value)}
              placeholder="e.g., Programming, Mechanical, Electrical"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
            />
            <button
              type="submit"
              disabled={loading === "subteam" || !newSubteam.trim()}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm font-semibold whitespace-nowrap"
            >
              {loading === "subteam" ? "Adding..." : "Add Subteam"}
            </button>
          </form>
        </div>

        {/* Google Sheets Sync */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-2">Google Sheets Sync</h2>
          <p className="text-sm text-slate-500 mb-4">
            Two-way sync: exports check-in/out events to Google Sheets and imports new entries from the sheet.
          </p>

          {/* Read/Write toggles + interval */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleReadEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    sheetsReadEnabled ? "bg-green-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      sheetsReadEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-700">Read from Sheets</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleWriteEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    sheetsWriteEnabled ? "bg-green-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      sheetsWriteEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-700">Write to Sheets</span>
              </div>
            </div>

            {(sheetsReadEnabled || sheetsWriteEnabled) && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Auto-sync every</label>
                <select
                  value={String(sheetsSyncInterval)}
                  onChange={(e) => handleSyncIntervalChange(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
                >
                  <option value="5">5 min</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                  <option value="360">6 hours</option>
                  <option value="1440">24 hours</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleSyncSheets}
              disabled={loading === "sync"}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-semibold"
            >
              {loading === "sync" ? "Syncing..." : "Sync Now"}
            </button>
            {syncStatus && (
              <span className="text-sm text-slate-600">{syncStatus}</span>
            )}
          </div>

          {/* Last sync info */}
          {(sheetsLastSynced || sheetsLastImported) && (
            <div className="text-xs text-slate-400 space-y-0.5 mb-2">
              {sheetsLastSynced && (
                <p>Last exported: {new Date(sheetsLastSynced).toLocaleString("en-US", { timeZone: "America/Chicago", hour12: true })}</p>
              )}
              {sheetsLastImported && (
                <p>Last imported: {new Date(sheetsLastImported).toLocaleString("en-US", { timeZone: "America/Chicago", hour12: true })}</p>
              )}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Requires <span className="font-mono">GOOGLE_SERVICE_ACCOUNT_KEY</span> and <span className="font-mono">GOOGLE_SHEET_ID</span> environment variables.
          </p>
        </div>

        {/* Student Roster */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Student Roster</h2>

          <form onSubmit={handleAddStudent} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Student name"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
            />
            <button
              type="submit"
              disabled={loading === "add" || !newName.trim()}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm font-semibold whitespace-nowrap"
            >
              {loading === "add" ? "Adding..." : "Add Student"}
            </button>
          </form>

          {students.length === 0 ? (
            <p className="text-slate-500 text-sm">No students registered yet.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Name</th>
                    <th className="text-center px-4 py-2 font-medium text-slate-600">Total Check-ins</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">{student.name}</td>
                      <td className="px-4 py-2 text-center text-slate-500">
                        {student._count.attendances}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          disabled={loading === `delete-${student.id}`}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          {loading === `delete-${student.id}` ? "Removing..." : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attendance Stats */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Attendance Stats</h2>
              <Link
                href="/admin/dashboard/students/report"
                className="text-sm text-primary hover:text-primary-dark font-medium"
              >
                View Full Report →
              </Link>
            </div>
            <select
              value={selectedSeason}
              onChange={(e) => handleSeasonChange(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">All Time</option>
              {seasons.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-800">
                {stats.totalStudents}
              </div>
              <div className="text-xs text-slate-500 mt-1">Students</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-800">
                {stats.totalDays}
              </div>
              <div className="text-xs text-slate-500 mt-1">Days Tracked</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-800">
                {stats.totalHours}
              </div>
              <div className="text-xs text-slate-500 mt-1">Total Hours</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-slate-800">
                {stats.avgAttendanceRate}%
              </div>
              <div className="text-xs text-slate-500 mt-1">Avg Attendance</div>
            </div>
          </div>

          {/* Attendance Table */}
          {attendanceStudents.length === 0 ? (
            <p className="text-slate-500 text-sm">No attendance data yet.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Name</th>
                    <th className="text-center px-4 py-2 font-medium text-slate-600">Check-ins</th>
                    <th className="text-center px-4 py-2 font-medium text-slate-600">Hours</th>
                    <th className="text-center px-4 py-2 font-medium text-slate-600">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceStudents.map((student) => {
                    const h = Math.floor(student.totalHours);
                    const m = Math.round((student.totalHours - h) * 60);
                    const hoursStr = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : (m > 0 ? `${m}m` : "0m");
                    return (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{student.name}</td>
                      <td className="px-4 py-2 text-center">{student.totalCheckIns}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{hoursStr}</td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            student.attendanceRate >= 80
                              ? "bg-green-100 text-green-700"
                              : student.attendanceRate >= 50
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {student.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3">
            Check-in page: <span className="font-mono">/student</span>
          </p>
        </div>
      </div>
    </div>
  );
}
