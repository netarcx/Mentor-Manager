"use client";

import { useState, useEffect, useCallback } from "react";

interface Student {
  id: number;
  name: string;
}

interface AttendanceRecord {
  studentId: number;
  checkedInAt: string;
}

export default function StudentAttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [checkedIn, setCheckedIn] = useState<Set<number>>(new Set());
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/student-attendance"),
      ]);
      const studentsData = await studentsRes.json();
      const attendanceData = await attendanceRes.json();

      setStudents(studentsData.students || []);
      setDate(attendanceData.date || "");
      setCheckedIn(
        new Set(
          (attendanceData.attendance || []).map(
            (a: AttendanceRecord) => a.studentId
          )
        )
      );
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

  async function handleCheckIn(studentId: number) {
    if (checkedIn.has(studentId) || checkingIn !== null) return;

    setCheckingIn(studentId);
    try {
      const res = await fetch("/api/student-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      if (res.ok) {
        setCheckedIn((prev) => new Set([...prev, studentId]));
      }
    } catch {
      // Silent fail
    } finally {
      setCheckingIn(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-lg">Loading...</p>
      </div>
    );
  }

  const checkedInCount = checkedIn.size;

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
            {checkedInCount} of {students.length} checked in
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
              const isCheckedIn = checkedIn.has(student.id);
              const isLoading = checkingIn === student.id;

              return (
                <button
                  key={student.id}
                  onClick={() => handleCheckIn(student.id)}
                  disabled={isCheckedIn || isLoading}
                  className={`p-5 rounded-xl text-lg font-semibold transition-all select-none ${
                    isCheckedIn
                      ? "bg-green-100 border-2 border-green-500 text-green-800"
                      : isLoading
                        ? "bg-slate-100 border-2 border-slate-300 text-slate-400"
                        : "bg-white border-2 border-slate-200 text-slate-800 hover:border-primary active:scale-95"
                  }`}
                >
                  <span>{student.name}</span>
                  {isCheckedIn && (
                    <span className="ml-2 text-green-600">&#10003;</span>
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
