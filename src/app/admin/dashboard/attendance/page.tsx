"use client";

import { useState, useEffect } from "react";

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

export default function AttendancePage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [mentors, setMentors] = useState<MentorAttendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seasons")
      .then((res) => res.json())
      .then((data) => setSeasons(data.seasons || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = selectedSeason
      ? `/api/admin/attendance?seasonId=${selectedSeason}`
      : "/api/admin/attendance";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setMentors(data.mentors || []);
        setStats(data.stats || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSeason]);

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
    </div>
  );
}
