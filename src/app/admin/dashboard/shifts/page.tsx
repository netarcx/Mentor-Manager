"use client";

import { useState, useEffect } from "react";
import { isWithinDays } from "@/lib/utils";
import { MIN_MENTOR_SIGNUPS } from "@/lib/constants";

interface Signup {
  id: number;
  checkedInAt: string | null;
  virtual: boolean;
  note: string;
  mentor: { id: number; name: string };
}

interface Shift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  cancelled: boolean;
  templateId: number | null;
  _count: { signups: number };
  signups: Signup[];
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);
  const [form, setForm] = useState({
    date: "",
    startTime: "18:00",
    endTime: "21:00",
    label: "",
  });

  async function fetchShifts() {
    const res = await fetch("/api/admin/shifts");
    const data = await res.json();
    setShifts(data.shifts || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchShifts();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ date: "", startTime: "18:00", endTime: "21:00", label: "" });
    fetchShifts();
  }

  async function toggleCancel(shift: Shift) {
    await fetch(`/api/admin/shifts/${shift.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelled: !shift.cancelled }),
    });
    fetchShifts();
  }

  async function deleteShift(id: number) {
    if (!confirm("Delete this shift?")) return;
    const res = await fetch(`/api/admin/shifts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
    fetchShifts();
  }

  async function handleCheckIn(signupId: number) {
    await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupId }),
    });
    fetchShifts();
  }

  async function handleUndoCheckIn(signupId: number) {
    await fetch("/api/check-in", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupId }),
    });
    fetchShifts();
  }

  async function handleCheckInAll(shift: Shift) {
    const unchecked = shift.signups.filter((s) => !s.checkedInAt).map((s) => s.id);
    if (unchecked.length === 0) return;

    await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupIds: unchecked }),
    });
    fetchShifts();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Shifts</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
        >
          Add One-Off Shift
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6 space-y-4"
        >
          <h3 className="font-semibold">New One-Off Shift</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. Special Build Day"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                End Time
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : shifts.filter((s) => !s.cancelled).length === 0 ? (
        <p className="text-slate-500 italic">
          No shifts yet. Create templates and generate shifts, or add one-off
          shifts.
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Label
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Signups
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
              {shifts.filter((s) => !s.cancelled).map((s, i, arr) => {
                const needsHelp = s._count.signups < MIN_MENTOR_SIGNUPS && isWithinDays(s.date, 7);
                const isExpanded = expandedShift === s.id;
                const checkedIn = s.signups.filter((su) => su.checkedInAt).length;
                const prevDate = i > 0 ? arr[i - 1].date : null;
                const isNewDay = s.date !== prevDate;
                return (
                <tbody key={s.id}>
                  {isNewDay && (
                    <tr>
                      <td colSpan={5} className={`px-4 py-2 bg-slate-100 font-semibold text-sm text-slate-700 ${i > 0 ? "border-t-2 border-slate-300" : ""}`}>
                        {new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`border-t border-slate-100 hover:bg-slate-50 ${
                      needsHelp ? "bg-amber-50" : ""
                    } ${s._count.signups > 0 ? "cursor-pointer" : ""}`}
                    onClick={() => {
                      if (s._count.signups > 0) {
                        setExpandedShift(isExpanded ? null : s.id);
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium">
                      {s._count.signups > 0 && (
                        <span className="text-slate-400 mr-1">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                      )}
                      {s.startTime} - {s.endTime}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.label || "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          s.templateId
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {s.templateId ? "Template" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {needsHelp ? (
                        <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-1 rounded">
                          {s._count.signups} &#9888;
                        </span>
                      ) : s._count.signups > 0 ? (
                        <span>
                          {s._count.signups}
                          {checkedIn > 0 && (
                            <span className="ml-1 text-xs text-green-600">
                              ({checkedIn} checked in)
                            </span>
                          )}
                        </span>
                      ) : (
                        s._count.signups
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleCancel(s)}
                        className="text-sm text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                      {s._count.signups === 0 && (
                        <button
                          onClick={() => deleteShift(s.id)}
                          className="text-sm text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-600">
                            Signups ({s.signups.length})
                          </span>
                          {s.signups.some((su) => !su.checkedInAt) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckInAll(s);
                              }}
                              className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                            >
                              Check in all ({s.signups.filter((su) => !su.checkedInAt).length})
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {s.signups.map((su) => (
                            <div
                              key={su.id}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                                su.checkedInAt ? "bg-green-50 border border-green-200" : "bg-white border border-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {su.checkedInAt ? (
                                  <span className="text-green-600 text-sm">&#10003;</span>
                                ) : (
                                  <span className="text-slate-300 text-sm">&#9675;</span>
                                )}
                                <div>
                                  <span className="font-medium text-sm">{su.mentor.name}</span>
                                  {su.virtual && (
                                    <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Virtual</span>
                                  )}
                                  {su.note && (
                                    <span className="ml-2 text-xs text-slate-400">&mdash; {su.note}</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                {su.checkedInAt ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUndoCheckIn(su.id);
                                    }}
                                    className="text-xs text-red-500 hover:underline"
                                  >
                                    Undo
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCheckIn(su.id);
                                    }}
                                    className="text-xs text-green-600 hover:underline font-medium"
                                  >
                                    Check in
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                );
              })}
          </table>
        </div>
      )}
    </div>
  );
}
