"use client";

import { useState, useEffect } from "react";

interface Student {
  id: number;
  name: string;
  _count: { attendances: number };
}

interface AttendanceStudent {
  id: number;
  name: string;
  totalCheckIns: number;
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
  const [stats, setStats] = useState({ totalStudents: 0, totalDays: 0, avgAttendanceRate: 0 });
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStudents();
    fetchSeasons();
    fetchAttendance();
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
            <h2 className="text-lg font-semibold">Attendance Stats</h2>
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
          <div className="grid grid-cols-3 gap-4 mb-6">
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
                    <th className="text-center px-4 py-2 font-medium text-slate-600">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{student.name}</td>
                      <td className="px-4 py-2 text-center">{student.totalCheckIns}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3">
            Check-in page: <span className="font-mono">/student/attendance</span>
          </p>
        </div>
      </div>
    </div>
  );
}
