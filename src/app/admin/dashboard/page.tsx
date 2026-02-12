"use client";

import { useState, useEffect } from "react";

interface SignupRow {
  id: number;
  note: string;
  customStartTime: string | null;
  customEndTime: string | null;
  signedUpAt: string;
  mentor: { name: string; email: string };
  shift: { date: string; startTime: string; endTime: string; label: string };
}

interface ShiftRow {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  signups: SignupRow[];
}

export default function AdminOverview() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shifts")
      .then((r) => r.json())
      .then((data) => setShifts(data.shifts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allSignups = shifts
    .flatMap((s) =>
      s.signups.map((signup: SignupRow) => ({
        ...signup,
        shift: { date: s.date, startTime: s.startTime, endTime: s.endTime, label: s.label },
      }))
    )
    .sort((a, b) => new Date(b.signedUpAt).getTime() - new Date(a.signedUpAt).getTime());

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Overview</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow border border-slate-100">
          <div className="text-2xl font-bold text-primary">{shifts.length}</div>
          <div className="text-sm text-slate-500">Upcoming Shifts</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow border border-slate-100">
          <div className="text-2xl font-bold text-navy">{allSignups.length}</div>
          <div className="text-sm text-slate-500">Total Signups</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow border border-slate-100">
          <div className="text-2xl font-bold text-navy">
            {new Set(allSignups.map((s) => s.mentor.email)).size}
          </div>
          <div className="text-sm text-slate-500">Unique Mentors</div>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">All Signups</h2>
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : allSignups.length === 0 ? (
        <p className="text-slate-500 italic">No signups yet.</p>
      ) : (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Mentor
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Shift Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Note
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Signed Up
                </th>
              </tr>
            </thead>
            <tbody>
              {allSignups.map((signup) => (
                <tr
                  key={signup.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{signup.mentor.name}</div>
                    <div className="text-sm text-slate-400">
                      {signup.mentor.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">{signup.shift.date}</td>
                  <td className="px-4 py-3">
                    {signup.shift.startTime} - {signup.shift.endTime}
                    {(signup.customStartTime || signup.customEndTime) && (
                      <div className="text-xs text-primary">
                        Attending: {signup.customStartTime || signup.shift.startTime} - {signup.customEndTime || signup.shift.endTime}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {signup.note || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {new Date(signup.signedUpAt).toLocaleString()}
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
