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
}

type AttendanceState = {
  checkedInAt: string;
  checkedOutAt: string | null;
};

export default function StudentAttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<number, AttendanceState>>(new Map());
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [tapping, setTapping] = useState<number | null>(null);

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

      const map = new Map<number, AttendanceState>();
      for (const a of (attendanceData.attendance || []) as AttendanceRecord[]) {
        map.set(a.studentId, {
          checkedInAt: a.checkedInAt,
          checkedOutAt: a.checkedOutAt,
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

  async function handleTap(studentId: number) {
    if (tapping !== null) return;

    setTapping(studentId);
    try {
      const res = await fetch("/api/student-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
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
            });
          } else {
            next.set(studentId, {
              checkedInAt: record.checkedInAt,
              checkedOutAt: record.checkedOutAt,
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
                  className={`p-5 rounded-xl text-center transition-all select-none ${
                    isCheckedOut
                      ? "bg-blue-50 border-2 border-blue-400 text-blue-800"
                      : isCheckedIn
                        ? "bg-green-100 border-2 border-green-500 text-green-800"
                        : isLoading
                          ? "bg-slate-100 border-2 border-slate-300 text-slate-400"
                          : "bg-white border-2 border-slate-200 text-slate-800 hover:border-primary active:scale-95"
                  }`}
                >
                  <div className="text-lg font-semibold">
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
                    </div>
                  )}
                  {isCheckedOut && record && (
                    <div className="text-xs mt-1 opacity-75">
                      {formatDuration(record.checkedInAt, record.checkedOutAt!)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
