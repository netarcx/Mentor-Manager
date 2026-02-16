"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Season {
  id: number;
  name: string;
}

interface StudentOption {
  id: number;
  name: string;
}

interface AttendanceEntry {
  studentId: number;
  studentName: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  duration: number | null;
}

interface DayGroup {
  date: string;
  entries: AttendanceEntry[];
  totalStudents: number;
  totalMinutes: number;
}

interface Stats {
  totalSessions: number;
  totalDays: number;
  totalStudents: number;
  totalHours: number;
}

export default function StudentAttendanceReportPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [days, setDays] = useState<DayGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/seasons")
      .then((res) => res.json())
      .then((data) => setSeasons(data.seasons || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSeason) params.set("seasonId", selectedSeason);
    if (selectedStudent) params.set("studentId", selectedStudent);
    const qs = params.toString();
    const url = `/api/admin/student-attendance/report${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setDays(data.days || []);
        setStats(data.stats || null);
        if (data.students) setStudents(data.students);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSeason, selectedStudent]);

  function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Chicago",
    });
  }

  function formatDuration(minutes: number): string {
    if (minutes <= 0) return "0m";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  function formatDayTotal(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard/students"
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">Student Attendance Report</h1>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          >
            <option value="">All Students</option>
            {students.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          >
            <option value="">All Time</option>
            {seasons.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow border border-slate-100 p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{stats.totalStudents}</div>
                <div className="text-sm text-slate-500">Students</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{stats.totalDays}</div>
                <div className="text-sm text-slate-500">Days Tracked</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{stats.totalSessions}</div>
                <div className="text-sm text-slate-500">Total Check-Ins</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{stats.totalHours}</div>
                <div className="text-sm text-slate-500">Total Hours</div>
              </div>
            </div>
          )}

          {/* Daily Breakdown */}
          {days.length === 0 ? (
            <p className="text-slate-500 italic">No attendance data found for the selected filters.</p>
          ) : (
            <div className="space-y-4">
              {days.map((day) => (
                <div
                  key={day.date}
                  className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden"
                >
                  {/* Day Header */}
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div className="font-semibold text-slate-800">
                      {formatDate(day.date)}
                    </div>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>{day.totalStudents} student{day.totalStudents !== 1 ? "s" : ""}</span>
                      <span>{formatDayTotal(day.totalMinutes)}</span>
                    </div>
                  </div>

                  {/* Day Entries */}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Check In</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Check Out</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.entries.map((entry) => (
                        <tr
                          key={`${day.date}-${entry.studentId}`}
                          className="border-t border-slate-50 hover:bg-slate-50"
                        >
                          <td className="px-4 py-2 font-medium text-slate-800">
                            {entry.studentName}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600">
                            {formatTime(entry.checkedInAt)}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-600">
                            {entry.checkedOutAt ? (
                              formatTime(entry.checkedOutAt)
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Present
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-600">
                            {entry.duration !== null ? formatDuration(entry.duration) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
