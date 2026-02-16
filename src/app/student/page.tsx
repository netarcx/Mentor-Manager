"use client";

import { useState, useEffect, useCallback } from "react";

interface Student {
  id: number;
  name: string;
}

interface AttendanceRecord {
  studentId: number;
  checkedInAt: string;
  checkedOutAt: string | null;
  subteam: string;
}

type AttendanceState = {
  checkedInAt: string;
  checkedOutAt: string | null;
  subteam: string;
};

export default function StudentPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<number, AttendanceState>>(new Map());
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [tapping, setTapping] = useState<number | null>(null);

  // PIN gate state
  const [pinRequired, setPinRequired] = useState(false);
  const [pinVerified, setPinVerified] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem("student-pin-unlocked");
      if (!stored) return false;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      return stored === today;
    } catch {
      return false;
    }
  });
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  // Subteam picker / checkout confirm state
  const [subteams, setSubteams] = useState<string[]>([]);
  const [subteamPicker, setSubteamPicker] = useState<number | null>(null);
  const [confirmCheckout, setConfirmCheckout] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/student-attendance"),
      ]);
      const studentsData = await studentsRes.json();
      const attendanceData = await attendanceRes.json();

      if (studentsData.enabled === false || attendanceData.enabled === false) {
        setEnabled(false);
        return;
      }

      setStudents(studentsData.students || []);
      setDate(attendanceData.date || "");
      setPinRequired(!!attendanceData.pinRequired);
      if (attendanceData.subteams) setSubteams(attendanceData.subteams);

      const map = new Map<number, AttendanceState>();
      for (const a of (attendanceData.attendance || []) as AttendanceRecord[]) {
        map.set(a.studentId, {
          checkedInAt: a.checkedInAt,
          checkedOutAt: a.checkedOutAt,
          subteam: a.subteam || "",
        });
      }
      setAttendance(map);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handlePinSubmit() {
    setPinError("");
    try {
      const res = await fetch("/api/student-attendance/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();

      if (data.success) {
        setPinVerified(true);
        setPinInput("");
        try {
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          localStorage.setItem("student-pin-unlocked", today);
        } catch { /* localStorage unavailable */ }
      } else {
        setPinError("Incorrect PIN");
        setPinInput("");
      }
    } catch {
      setPinError("Something went wrong");
    }
  }

  function handlePinKey(key: string) {
    if (key === "clear") {
      setPinInput("");
      setPinError("");
      return;
    }
    if (key === "back") {
      setPinInput((prev) => prev.slice(0, -1));
      setPinError("");
      return;
    }
    if (pinInput.length >= 6) return;
    setPinError("");
    const next = pinInput + key;
    setPinInput(next);
  }

  function handleTap(studentId: number) {
    if (tapping !== null) return;

    const record = attendance.get(studentId);
    const isCheckedIn = !!record && !record.checkedOutAt;

    if (isCheckedIn) {
      // Show subteam picker or confirmation before clocking out
      if (subteams.length > 0) {
        setSubteamPicker(studentId);
      } else {
        setConfirmCheckout(studentId);
      }
      return;
    }

    // Check in directly
    doCheckInOut(studentId, "");
  }

  async function doCheckInOut(studentId: number, subteam: string) {
    setTapping(studentId);
    setSubteamPicker(null);
    try {
      const res = await fetch("/api/student-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subteam }),
      });

      if (res.ok) {
        const data = await res.json();
        const record = data.record;
        setAttendance((prev) => {
          const next = new Map(prev);
          if (data.status === "checked_in") {
            next.set(studentId, {
              checkedInAt: record.checkedInAt,
              checkedOutAt: null,
              subteam: record.subteam || subteam,
            });
          } else {
            next.set(studentId, {
              checkedInAt: record.checkedInAt,
              checkedOutAt: record.checkedOutAt,
              subteam: record.subteam || "",
            });
          }
          return next;
        });
      }
    } catch {
      // Silent fail
    } finally {
      setTapping(null);
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTimeShort(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Chicago",
    });
  }

  function formatDuration(inAt: string, outAt: string): string {
    const ms = new Date(outAt).getTime() - new Date(inAt).getTime();
    if (ms <= 0) return "0m";
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-lg">Loading...</p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Check-In Not Available</h1>
          <p className="text-slate-500">Student check-in is currently disabled.</p>
        </div>
      </div>
    );
  }

  // PIN gate screen
  if (pinRequired && !pinVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Student Check-In</h1>
          <p className="text-sm text-slate-500 mb-6">Enter the mentor PIN to unlock</p>

          {/* PIN display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full ${
                  i < pinInput.length ? "bg-primary" : "bg-slate-200"
                }`}
              />
            ))}
          </div>

          {pinError && (
            <p className="text-red-500 text-sm mb-4">{pinError}</p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
              <button
                key={key}
                onClick={() => handlePinKey(key)}
                className={`py-4 rounded-xl font-semibold transition-colors select-none ${
                  key === "clear" || key === "back"
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm"
                    : "bg-slate-50 text-slate-800 hover:bg-slate-100 active:bg-slate-200 text-lg"
                }`}
              >
                {key === "clear" ? "Clear" : key === "back" ? "\u232B" : key}
              </button>
            ))}
          </div>

          <button
            onClick={handlePinSubmit}
            disabled={pinInput.length < 4}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // Count students currently in the shop (checked in, not checked out)
  const presentCount = Array.from(attendance.values()).filter(
    (a) => !a.checkedOutAt
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Student Check-In
          </h1>
          <p className="text-lg text-slate-600">{formatDate(date)}</p>
          <p className="text-sm text-slate-500 mt-1">
            {presentCount} of {students.length} present
          </p>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">
              No students registered yet.
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Ask an admin to add students from the admin dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {students.map((student) => {
              const record = attendance.get(student.id);
              const isLoading = tapping === student.id;
              const isCheckedIn = !!record && !record.checkedOutAt;
              const isCheckedOut = !!record && !!record.checkedOutAt;

              return (
                <button
                  key={student.id}
                  onClick={() => handleTap(student.id)}
                  disabled={isLoading}
                  className={`p-3 sm:p-5 rounded-xl text-center transition-all select-none ${
                    isCheckedOut
                      ? "bg-blue-50 border-2 border-blue-400 text-blue-800"
                      : isCheckedIn
                        ? "bg-green-100 border-2 border-green-500 text-green-800"
                        : isLoading
                          ? "bg-slate-100 border-2 border-slate-300 text-slate-400"
                          : "bg-white border-2 border-slate-200 text-slate-800 hover:border-primary active:scale-95"
                  }`}
                >
                  <div className="text-sm sm:text-lg font-semibold truncate">
                    {student.name}
                    {isCheckedIn && (
                      <span className="ml-2 text-green-600">&#10003;</span>
                    )}
                    {isCheckedOut && (
                      <span className="ml-2 text-blue-500">&#10003;</span>
                    )}
                  </div>
                  {isCheckedIn && record && (
                    <div className="text-xs mt-1 opacity-75">
                      In: {formatTimeShort(record.checkedInAt)}
                      {record.subteam && <> &middot; {record.subteam}</>}
                    </div>
                  )}
                  {isCheckedOut && record && (
                    <div className="text-xs mt-1 opacity-75">
                      {formatDuration(record.checkedInAt, record.checkedOutAt!)}
                      {record.subteam && <> &middot; {record.subteam}</>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Subteam picker modal (clock-out with subteams) */}
      {subteamPicker !== null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSubteamPicker(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-800 mb-1">
              Clock out {students.find((s) => s.id === subteamPicker)?.name}?
            </h2>
            <p className="text-sm text-slate-500 mb-4">Which subteam did you work with today?</p>
            <div className="grid grid-cols-2 gap-2">
              {subteams.map((team) => (
                <button
                  key={team}
                  onClick={() => doCheckInOut(subteamPicker, team)}
                  className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-800 hover:border-primary hover:bg-primary/5 active:scale-95 transition-all"
                >
                  {team}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSubteamPicker(null)}
              className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirm clock-out modal (no subteams) */}
      {confirmCheckout !== null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setConfirmCheckout(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              Clock out {students.find((s) => s.id === confirmCheckout)?.name}?
            </h2>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to clock out?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCheckout(null)}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  doCheckInOut(confirmCheckout, "");
                  setConfirmCheckout(null);
                }}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark active:scale-95 transition-all"
              >
                Clock Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
