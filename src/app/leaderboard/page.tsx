"use client";

import { useState, useEffect } from "react";

interface LeaderboardEntry {
  mentorName: string;
  totalHours: number;
  shiftCount: number;
}

interface Stats {
  totalHours: number;
  avgHoursPerMentor: number;
  totalShifts: number;
  mentorCount: number;
}

interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

export default function LeaderboardPage() {
  const [mentors, setMentors] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seasons")
      .then((r) => r.json())
      .then((data) => {
        if (data.seasons) setSeasons(data.seasons);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?seasonId=${selectedSeason}`)
      .then((r) => r.json())
      .then((data) => {
        setMentors(data.mentors || []);
        setStats(data.stats || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSeason]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="border border-slate-300 rounded-lg px-4 py-2 bg-white"
        >
          <option value="all">All Time</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow border border-slate-100">
            <div className="text-2xl font-bold text-primary">
              {stats.totalHours}
            </div>
            <div className="text-sm text-slate-500">Total Hours</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border border-slate-100">
            <div className="text-2xl font-bold text-navy">
              {stats.mentorCount}
            </div>
            <div className="text-sm text-slate-500">Mentors</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border border-slate-100">
            <div className="text-2xl font-bold text-navy">
              {stats.totalShifts}
            </div>
            <div className="text-sm text-slate-500">Total Shifts</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border border-slate-100">
            <div className="text-2xl font-bold text-navy">
              {stats.avgHoursPerMentor}
            </div>
            <div className="text-sm text-slate-500">Avg Hours/Mentor</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : mentors.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No data yet. Sign up for shifts to start tracking hours!
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-navy text-white">
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Mentor
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold">
                  Hours
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold">
                  Shifts
                </th>
              </tr>
            </thead>
            <tbody>
              {mentors.map((mentor, i) => (
                <tr
                  key={mentor.mentorName}
                  className={`border-t border-slate-100 ${
                    i < 3 ? "bg-accent-bg/50" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <span
                      className={`font-bold ${
                        i === 0
                          ? "text-yellow-500 text-xl"
                          : i === 1
                          ? "text-slate-400 text-lg"
                          : i === 2
                          ? "text-amber-600 text-lg"
                          : "text-slate-500"
                      }`}
                    >
                      #{i + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">{mentor.mentorName}</td>
                  <td className="px-6 py-4 text-right font-semibold text-primary">
                    {mentor.totalHours}h
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500">
                    {mentor.shiftCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
