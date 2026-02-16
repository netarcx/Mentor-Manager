"use client";

import { useState, useEffect, useCallback } from "react";

interface Student {
  id: number;
  name: string;
}

interface AttendanceRecord {
  id: number;
  studentId: number;
  checkedInAt: string;
  checkedOutAt: string | null;
  subteam: string;
}

export default function CaptainPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<number, AttendanceRecord>>(new Map());
  const [date, setDate] = useState("");
  const [subteams, setSubteams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // PIN gate
  const [pinVerified, setPinVerified] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem("captain-pin-unlocked");
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
  const [captainPin, setCaptainPin] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return sessionStorage.getItem("captain-pin") || ""; } catch { return ""; }
  });

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [editSubteam, setEditSubteam] = useState("");

  const fetchData = useCallback(async () => {
    if (!captainPin) return;
    try {
      const res = await fetch("/api/captain/attendance", {
        headers: { "x-captain-pin": captainPin },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setPinVerified(false);
          setCaptainPin("");
          try { localStorage.removeItem("captain-pin-unlocked"); sessionStorage.removeItem("captain-pin"); } catch {}
        }
        return;
      }
      const data = await res.json();
      setStudents(data.students || []);
      setDate(data.date || "");
      if (data.subteams) setSubteams(data.subteams);
      const map = new Map<number, AttendanceRecord>();
      for (const a of data.attendance || []) {
        map.set(a.studentId, a);
      }
      setAttendance(map);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [captainPin]);

  useEffect(() => {
    if (pinVerified && captainPin) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [pinVerified, captainPin, fetchData]);

  async function handlePinSubmit() {
    setPinError("");
    try {
      const res = await fetch("/api/captain/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (data.success) {
        setPinVerified(true);
        setCaptainPin(pinInput);
        setPinInput("");
        try {
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          localStorage.setItem("captain-pin-unlocked", today);
          sessionStorage.setItem("captain-pin", pinInput);
        } catch {}
      } else {
        setPinError(data.error || "Incorrect PIN");
        setPinInput("");
      }
    } catch {
      setPinError("Something went wrong");
    }
  }

  function handlePinKey(key: string) {
    if (key === "clear") { setPinInput(""); setPinError(""); return; }
    if (key === "back") { setPinInput((p) => p.slice(0, -1)); setPinError(""); return; }
    if (pinInput.length >= 6) return;
    setPinError("");
    setPinInput((p) => p + key);
  }

  async function handleAction(action: string, studentId: number, extra?: Record<string, unknown>) {
    setActionLoading(studentId);
    try {
      const res = await fetch("/api/captain/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-captain-pin": captainPin },
        body: JSON.stringify({ action, studentId, ...extra }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Action failed");
      }
    } catch {
      alert("Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  function startEdit(studentId: number) {
    const record = attendance.get(studentId);
    setEditingId(studentId);
    setEditIn(record ? isoToTimeInput(record.checkedInAt) : "");
    setEditOut(record?.checkedOutAt ? isoToTimeInput(record.checkedOutAt) : "");
    setEditSubteam(record?.subteam || "");
  }

  async function handleSaveEdit() {
    if (editingId === null) return;
    const record = attendance.get(editingId);

    if (!record) {
      // No record exists — clock in with specified time
      await handleAction("clock_in", editingId, {
        time: timeInputToISO(editIn, date),
        subteam: editSubteam,
      });
    } else {
      await handleAction("update_time", editingId, {
        checkedInAt: editIn ? timeInputToISO(editIn, date) : undefined,
        checkedOutAt: editOut ? timeInputToISO(editOut, date) : null,
        subteam: editSubteam,
      });
    }
    setEditingId(null);
  }

  function isoToTimeInput(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Chicago",
    });
  }

  function timeInputToISO(timeStr: string, dateStr: string): string {
    const [h, m] = timeStr.split(":").map(Number);
    // Build date in Central Time
    const d = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    return d.toISOString();
  }

  function formatTime12h(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString("en-US", {
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
    const min = totalMin % 60;
    if (h === 0) return `${min}m`;
    return min === 0 ? `${h}h` : `${h}h ${min}m`;
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

  // PIN gate screen
  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Captain Dashboard</h1>
          <p className="text-sm text-slate-500 mb-6">Enter the captain PIN to unlock</p>

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-lg">Loading...</p>
      </div>
    );
  }

  const presentCount = Array.from(attendance.values()).filter((a) => !a.checkedOutAt).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Captain Dashboard</h1>
          <p className="text-lg text-slate-600">{formatDate(date)}</p>
          <p className="text-sm text-slate-500 mt-1">
            {presentCount} of {students.length} present
          </p>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">No students registered yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((student) => {
              const record = attendance.get(student.id);
              const isCheckedIn = !!record && !record.checkedOutAt;
              const isCheckedOut = !!record && !!record.checkedOutAt;
              const isEditing = editingId === student.id;
              const isLoading = actionLoading === student.id;

              return (
                <div
                  key={student.id}
                  className={`bg-white rounded-xl border-2 p-4 transition-colors ${
                    isCheckedOut
                      ? "border-blue-300"
                      : isCheckedIn
                        ? "border-green-400"
                        : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">{student.name}</span>
                      {!record && (
                        <span className="ml-2 text-xs text-slate-400">Not checked in</span>
                      )}
                      {isCheckedIn && record && (
                        <span className="ml-2 text-xs text-green-600">
                          In at {formatTime12h(record.checkedInAt)}
                          {record.subteam && <> &middot; {record.subteam}</>}
                        </span>
                      )}
                      {isCheckedOut && record && (
                        <span className="ml-2 text-xs text-blue-600">
                          {formatTime12h(record.checkedInAt)} - {formatTime12h(record.checkedOutAt!)} ({formatDuration(record.checkedInAt, record.checkedOutAt!)})
                          {record.subteam && <> &middot; {record.subteam}</>}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!record && !isEditing && (
                        <button
                          onClick={() => handleAction("clock_in", student.id)}
                          disabled={isLoading}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                        >
                          Clock In
                        </button>
                      )}
                      {isCheckedIn && !isEditing && (
                        <button
                          onClick={() => handleAction("clock_out", student.id)}
                          disabled={isLoading}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                        >
                          Clock Out
                        </button>
                      )}
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(student.id)}
                          className="text-xs text-slate-500 hover:text-slate-700 underline"
                        >
                          Edit
                        </button>
                      )}
                      {record && !isEditing && (
                        <button
                          onClick={() => {
                            if (confirm(`Clear ${student.name}'s attendance for today?`)) {
                              handleAction("clear", student.id);
                            }
                          }}
                          disabled={isLoading}
                          className="text-xs text-red-500 hover:text-red-700 underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Clock In</label>
                          <input
                            type="time"
                            value={editIn}
                            onChange={(e) => setEditIn(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Clock Out</label>
                          <input
                            type="time"
                            value={editOut}
                            onChange={(e) => setEditOut(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                        {subteams.length > 0 && (
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Subteam</label>
                            <select
                              value={editSubteam}
                              onChange={(e) => setEditSubteam(e.target.value)}
                              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            >
                              <option value="">None</option>
                              {subteams.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editIn}
                          className="text-xs bg-primary text-white px-4 py-1.5 rounded-lg hover:bg-primary-dark disabled:opacity-50 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
