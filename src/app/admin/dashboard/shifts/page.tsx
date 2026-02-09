"use client";

import { useState, useEffect } from "react";

interface Shift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  cancelled: boolean;
  templateId: number | null;
  _count: { signups: number };
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
      ) : shifts.length === 0 ? (
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
                  Date
                </th>
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
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr
                  key={s.id}
                  className={`border-t border-slate-100 hover:bg-slate-50 ${
                    s.cancelled ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{s.date}</td>
                  <td className="px-4 py-3">
                    {s.startTime} - {s.endTime}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {s.label || "—"}
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
                  <td className="px-4 py-3">{s._count.signups}</td>
                  <td className="px-4 py-3">
                    {s.cancelled ? (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                        Cancelled
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => toggleCancel(s)}
                      className="text-sm text-slate-500 hover:underline"
                    >
                      {s.cancelled ? "Restore" : "Cancel"}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
