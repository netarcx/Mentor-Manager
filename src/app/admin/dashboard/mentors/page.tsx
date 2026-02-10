"use client";

import { useState, useEffect } from "react";

interface Mentor {
  id: number;
  name: string;
  email: string;
}

interface Adjustment {
  id: number;
  mentorId: number;
  hours: number;
  reason: string;
  date: string;
  createdAt: string;
  mentor: { name: string; email: string };
}

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    mentorId: "",
    hours: "",
    reason: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function fetchData() {
    try {
      const [mentorRes, adjRes] = await Promise.all([
        fetch("/api/mentors"),
        fetch("/api/admin/hour-adjustments"),
      ]);
      const mentorData = await mentorRes.json();
      const adjData = await adjRes.json();
      setMentors(mentorData.mentors || []);
      setAdjustments(adjData.adjustments || []);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const hours = parseFloat(form.hours);
    if (!form.mentorId || isNaN(hours) || hours === 0 || !form.date) {
      showError("Please select a mentor, enter non-zero hours, and pick a date");
      return;
    }

    try {
      const res = await fetch("/api/admin/hour-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorId: parseInt(form.mentorId),
          hours,
          reason: form.reason,
          date: form.date,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showError(data.error || "Failed to create adjustment");
        return;
      }

      showMessage("Hour adjustment added!");
      setForm({ mentorId: "", hours: "", reason: "", date: new Date().toISOString().split("T")[0] });
      setShowForm(false);
      fetchData();
    } catch {
      showError("Failed to create adjustment");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this hour adjustment?")) return;

    try {
      const res = await fetch(`/api/admin/hour-adjustments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        showError("Failed to delete adjustment");
        return;
      }
      fetchData();
    } catch {
      showError("Failed to delete adjustment");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mentors</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
        >
          Add Hour Adjustment
        </button>
      </div>

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

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6 space-y-4"
        >
          <h3 className="font-semibold">New Hour Adjustment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mentor</label>
              <select
                required
                value={form.mentorId}
                onChange={(e) => setForm({ ...form, mentorId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Select a mentor...</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Hours (+/-)
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. 3 or -1.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Used for season filtering on the leaderboard
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. Forgot to sign up for Feb 5 shift"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              Add Adjustment
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
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-3">Hour Adjustments</h2>
          {adjustments.length === 0 ? (
            <p className="text-slate-500 italic mb-8">
              No hour adjustments yet. Use the button above to add one.
            </p>
          ) : (
            <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden mb-8">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Mentor
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adj) => (
                    <tr
                      key={adj.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{adj.mentor.name}</div>
                        <div className="text-sm text-slate-400">
                          {adj.mentor.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium ${
                            adj.hours > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {adj.hours > 0 ? "+" : ""}
                          {adj.hours}h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{adj.date}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {adj.reason || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(adj.id)}
                          className="text-sm text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="text-lg font-semibold mb-3">All Mentors</h2>
          {mentors.length === 0 ? (
            <p className="text-slate-500 italic">No mentors registered yet.</p>
          ) : (
            <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mentors.map((m) => (
                    <tr
                      key={m.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-slate-500">{m.email}</td>
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
