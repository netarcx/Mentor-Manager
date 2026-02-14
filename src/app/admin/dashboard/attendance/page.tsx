"use client";

import { useState, useEffect, useCallback } from "react";

interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

interface MentorAttendance {
  id: number;
  name: string;
  email: string;
  totalSignups: number;
  totalCheckIns: number;
  attendanceRate: number;
}

interface AttendanceStats {
  totalSignups: number;
  totalCheckIns: number;
  attendanceRate: number;
  mentorCount: number;
}

interface UncheckedSignup {
  id: number;
  shiftDate: string;
  startTime: string;
  endTime: string;
}

export default function AttendancePage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [mentors, setMentors] = useState<MentorAttendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string; to: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  // Bulk check-in state
  const [bulkMentorId, setBulkMentorId] = useState("");
  const [uncheckedSignups, setUncheckedSignups] = useState<UncheckedSignup[]>([]);
  const [selectedSignups, setSelectedSignups] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");

  useEffect(() => {
    fetch("/api/seasons")
      .then((res) => res.json())
      .then((data) => setSeasons(data.seasons || []))
      .catch(() => {});
  }, []);

  const fetchAttendance = useCallback(() => {
    setLoading(true);
    const url = selectedSeason
      ? `/api/admin/attendance?seasonId=${selectedSeason}`
      : "/api/admin/attendance";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setMentors(data.mentors || []);
        setStats(data.stats || null);
        setDateRange(data.dateRange || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSeason]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  async function fetchUnchecked(mentorId: string) {
    if (!mentorId) {
      setUncheckedSignups([]);
      setSelectedSignups(new Set());
      return;
    }
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance/unchecked?mentorId=${mentorId}`);
      if (res.ok) {
        const data = await res.json();
        setUncheckedSignups(data.signups || []);
        setSelectedSignups(new Set());
      }
    } catch {
      // Silent fail
    } finally {
      setBulkLoading(false);
    }
  }

  function handleMentorChange(value: string) {
    setBulkMentorId(value);
    setBulkMessage("");
    setBulkError("");
    fetchUnchecked(value);
  }

  function toggleSignup(id: number) {
    setSelectedSignups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedSignups.size === uncheckedSignups.length) {
      setSelectedSignups(new Set());
    } else {
      setSelectedSignups(new Set(uncheckedSignups.map((s) => s.id)));
    }
  }

  async function handleBulkCheckIn() {
    if (selectedSignups.size === 0) return;
    setBulkLoading(true);
    setBulkMessage("");
    setBulkError("");
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupIds: Array.from(selectedSignups) }),
      });
      if (res.ok) {
        const data = await res.json();
        setBulkMessage(`Checked in ${data.updated} shift${data.updated === 1 ? "" : "s"}`);
        setSelectedSignups(new Set());
        // Refresh the unchecked list and attendance stats
        fetchUnchecked(bulkMentorId);
        fetchAttendance();
      } else {
        setBulkError("Failed to check in");
      }
    } catch {
      setBulkError("Failed to check in");
    } finally {
      setBulkLoading(false);
    }
  }

  function formatShiftDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Attendance Report</h1>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
        >
          <option value="">All Time</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {dateRange && (
        <p className="text-xs text-slate-400 -mt-4 mb-4">
          Showing shifts from {dateRange.from}{dateRange.to ? ` to ${dateRange.to}` : " onward"}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow border border-slate-100 p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{stats.mentorCount}</div>
                <div className="text-sm text-slate-500">Mentors</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{stats.totalSignups}</div>
                <div className="text-sm text-slate-500">Total Signups</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{stats.totalCheckIns}</div>
                <div className="text-sm text-slate-500">Check-Ins</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-4 text-center">
                <div className={`text-2xl font-bold ${
                  stats.attendanceRate >= 80
                    ? "text-green-600"
                    : stats.attendanceRate >= 50
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}>
                  {stats.attendanceRate}%
                </div>
                <div className="text-sm text-slate-500">Attendance Rate</div>
              </div>
            </div>
          )}

          {mentors.length === 0 ? (
            <p className="text-slate-500 italic">No signup data found for the selected period.</p>
          ) : (
            <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Mentor</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Signups</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Check-Ins</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {mentors.map((m) => (
                    <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-sm text-slate-400">{m.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center">{m.totalSignups}</td>
                      <td className="px-4 py-3 text-center">{m.totalCheckIns}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-medium ${
                          m.attendanceRate >= 80
                            ? "bg-green-100 text-green-700"
                            : m.attendanceRate >= 50
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}>
                          {m.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Bulk Check-In */}
      <div className="bg-white rounded-xl shadow border border-slate-100 p-6 mt-8">
        <h2 className="text-lg font-semibold mb-2">Bulk Check-In</h2>
        <p className="text-sm text-slate-500 mb-4">
          Retroactively check in a mentor for past shifts they signed up for but weren&apos;t clocked in.
        </p>

        {bulkMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {bulkMessage}
          </div>
        )}
        {bulkError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {bulkError}
          </div>
        )}

        <select
          value={bulkMentorId}
          onChange={(e) => handleMentorChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm w-full max-w-xs mb-4"
        >
          <option value="">Select a mentor...</option>
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {bulkLoading && <p className="text-slate-500 text-sm">Loading shifts...</p>}

        {!bulkLoading && bulkMentorId && uncheckedSignups.length === 0 && (
          <p className="text-slate-500 text-sm italic">No unchecked past shifts for this mentor.</p>
        )}

        {!bulkLoading && uncheckedSignups.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={toggleAll}
                className="text-sm text-primary hover:text-primary-dark font-medium"
              >
                {selectedSignups.size === uncheckedSignups.length ? "Deselect All" : "Select All"}
              </button>
              <span className="text-sm text-slate-500">
                {selectedSignups.size} of {uncheckedSignups.length} selected
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden mb-4 max-h-80 overflow-y-auto">
              {uncheckedSignups.map((signup) => (
                <label
                  key={signup.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${
                    selectedSignups.has(signup.id) ? "bg-primary/5" : "hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSignups.has(signup.id)}
                    onChange={() => toggleSignup(signup.id)}
                    className="rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{formatShiftDate(signup.shiftDate)}</span>
                    <span className="text-slate-500 text-sm ml-2">
                      {formatTime(signup.startTime)} &ndash; {formatTime(signup.endTime)}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleBulkCheckIn}
              disabled={selectedSignups.size === 0 || bulkLoading}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm font-semibold"
            >
              {bulkLoading ? "Checking in..." : `Check In ${selectedSignups.size} Shift${selectedSignups.size === 1 ? "" : "s"}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
