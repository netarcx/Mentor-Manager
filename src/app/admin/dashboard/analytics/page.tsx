"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Overview {
  totalMentorHours: number;
  totalStudentHours: number;
  activeMentors: number;
  activeStudents: number;
}

interface DailyEntry {
  date: string;
  mentors: number;
  students: number;
}

interface DayOfWeekEntry {
  day: string;
  mentors: number;
  students: number;
}

interface SubteamEntry {
  name: string;
  value: number;
}

interface TopMentor {
  name: string;
  hours: number;
  shifts: number;
}

interface TopStudent {
  name: string;
  hours: number;
  checkIns: number;
}

interface Season {
  id: number;
  name: string;
}

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<DailyEntry[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeekEntry[]>([]);
  const [subteamBreakdown, setSubteamBreakdown] = useState<SubteamEntry[]>([]);
  const [topMentors, setTopMentors] = useState<TopMentor[]>([]);
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedDays, setSelectedDays] = useState("0");
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
    if (selectedDays !== "0") params.set("days", selectedDays);
    const qs = params.toString();

    fetch(`/api/admin/analytics${qs ? `?${qs}` : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setOverview(data.overview || null);
        setDailyAttendance(data.dailyAttendance || []);
        setDayOfWeek(data.dayOfWeek || []);
        setSubteamBreakdown(data.subteamBreakdown || []);
        setTopMentors(data.topMentors || []);
        setTopStudents(data.topStudents || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSeason, selectedDays]);

  function formatDateShort(dateStr: string): string {
    const [, m, d] = dateStr.split("-").map(Number);
    return `${m}/${d}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          >
            <option value="0">All Time</option>
            <option value="30">Last 30 Days</option>
            <option value="60">Last 60 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          >
            <option value="">All Seasons</option>
            {seasons.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading analytics...</p>
      ) : (
        <div className="space-y-8">
          {/* Overview Cards */}
          {overview && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow border border-slate-100 p-5 text-center">
                <div className="text-3xl font-bold text-blue-600">{overview.totalMentorHours}</div>
                <div className="text-sm text-slate-500 mt-1">Mentor Hours</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-5 text-center">
                <div className="text-3xl font-bold text-green-600">{overview.totalStudentHours}</div>
                <div className="text-sm text-slate-500 mt-1">Student Hours</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-5 text-center">
                <div className="text-3xl font-bold text-purple-600">{overview.activeMentors}</div>
                <div className="text-sm text-slate-500 mt-1">Active Mentors</div>
              </div>
              <div className="bg-white rounded-xl shadow border border-slate-100 p-5 text-center">
                <div className="text-3xl font-bold text-amber-600">{overview.activeStudents}</div>
                <div className="text-sm text-slate-500 mt-1">Active Students</div>
              </div>
            </div>
          )}

          {/* Attendance Over Time */}
          {dailyAttendance.length > 0 && (
            <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Attendance Over Time</h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                  <Tooltip
                    labelFormatter={(label) => {
                      const [y, m, d] = String(label).split("-").map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="mentors"
                    name="Mentors"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="students"
                    name="Students"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Day of Week + Subteam row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Day of Week Patterns */}
            <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                Day of Week (Avg)
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dayOfWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mentors" name="Mentors" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="students" name="Students" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Subteam Breakdown */}
            {subteamBreakdown.length > 0 && (
              <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  Subteam Breakdown
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={subteamBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {subteamBreakdown.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Mentors + Top Students */}
          <div className="grid grid-cols-2 gap-6">
            {topMentors.length > 0 && (
              <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-lg font-semibold text-slate-800">Top Mentors</h2>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Hours</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Shifts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMentors.map((m, i) => (
                      <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                        <td className="px-6 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-6 py-2 font-medium text-slate-800">{m.name}</td>
                        <td className="px-6 py-2 text-right text-slate-600">{m.hours}</td>
                        <td className="px-6 py-2 text-right text-slate-600">{m.shifts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {topStudents.length > 0 && (
              <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-lg font-semibold text-slate-800">Top Students</h2>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Hours</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Check-Ins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStudents.map((s, i) => (
                      <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                        <td className="px-6 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-6 py-2 font-medium text-slate-800">{s.name}</td>
                        <td className="px-6 py-2 text-right text-slate-600">{s.hours}</td>
                        <td className="px-6 py-2 text-right text-slate-600">{s.checkIns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
