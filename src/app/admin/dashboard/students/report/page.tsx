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

interface Note {
  id: number;
  content: string;
  author: string;
  createdAt: string;
  student?: { name: string };
}

export default function StudentAttendanceReportPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [days, setDays] = useState<DayGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesMap, setNotesMap] = useState<Map<string, Note[]>>(new Map());
  const [newNoteMap, setNewNoteMap] = useState<Map<string, string>>(new Map());

  async function fetchNotesForDate(date: string) {
    try {
      const params = new URLSearchParams({ date });
      if (selectedStudent) params.set("studentId", selectedStudent);
      const res = await fetch(`/api/admin/student-notes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotesMap((prev) => new Map(prev).set(date, data.notes || []));
      }
    } catch {
      // silent
    }
  }

  async function handleAddNote(date: string, studentId?: number) {
    const text = newNoteMap.get(date) || "";
    if (!text.trim()) return;
    // If filtering by student, use that student; otherwise need a studentId
    const sid = studentId || (selectedStudent ? parseInt(selectedStudent, 10) : null);
    if (!sid) return;
    try {
      const res = await fetch("/api/admin/student-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: sid, date, content: text }),
      });
      if (res.ok) {
        setNewNoteMap((prev) => { const m = new Map(prev); m.delete(date); return m; });
        fetchNotesForDate(date);
      }
    } catch {
      // silent
    }
  }

  async function handleDeleteNote(noteId: number, date: string) {
    if (!confirm("Delete this note?")) return;
    try {
      const res = await fetch(`/api/admin/student-notes/${noteId}`, { method: "DELETE" });
      if (res.ok) fetchNotesForDate(date);
    } catch {
      // silent
    }
  }

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
        // Fetch notes for each day
        for (const day of data.days || []) {
          fetchNotesForDate(day.date);
        }
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

                  {/* Notes Section */}
                  {(() => {
                    const dayNotes = notesMap.get(day.date) || [];
                    const noteText = newNoteMap.get(day.date) || "";
                    return (
                      <div className="border-t border-amber-200 bg-amber-50/50 px-4 py-3">
                        <div className="text-xs font-semibold text-amber-700 mb-2">Notes</div>
                        {dayNotes.length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {dayNotes.map((note) => (
                              <div key={note.id} className="flex items-start justify-between gap-2 text-sm bg-white rounded-lg px-3 py-2 border border-amber-200">
                                <div>
                                  <span className="text-slate-700">{note.content}</span>
                                  <span className="text-xs text-slate-400 ml-2">
                                    — {note.author}
                                    {note.student?.name && <>, re: {note.student.name}</>}
                                    ,{" "}
                                    {new Date(note.createdAt).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                      timeZone: "America/Chicago",
                                    })}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeleteNote(note.id, day.date)}
                                  className="text-xs text-red-400 hover:text-red-600 shrink-0"
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedStudent && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={noteText}
                              onChange={(e) =>
                                setNewNoteMap((prev) => new Map(prev).set(day.date, e.target.value))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && noteText.trim()) handleAddNote(day.date);
                              }}
                              placeholder="Add a note for this student..."
                              className="flex-1 border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                            />
                            <button
                              onClick={() => handleAddNote(day.date)}
                              disabled={!noteText.trim()}
                              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
                            >
                              Add Note
                            </button>
                          </div>
                        )}
                        {!selectedStudent && (
                          <p className="text-xs text-slate-400 italic">Select a student to add notes.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
