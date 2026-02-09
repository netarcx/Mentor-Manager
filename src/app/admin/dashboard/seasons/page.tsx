"use client";

import { useState, useEffect } from "react";

interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });

  async function fetchSeasons() {
    const res = await fetch("/api/admin/seasons");
    const data = await res.json();
    setSeasons(data.seasons || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchSeasons();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId
      ? `/api/admin/seasons/${editingId}`
      : "/api/admin/seasons";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", startDate: "", endDate: "" });
    fetchSeasons();
  }

  async function deleteSeason(id: number) {
    if (!confirm("Delete this season?")) return;
    await fetch(`/api/admin/seasons/${id}`, { method: "DELETE" });
    fetchSeasons();
  }

  function startEdit(season: Season) {
    setForm({
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
    });
    setEditingId(season.id);
    setShowForm(true);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Seasons</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm({ name: "", startDate: "", endDate: "" });
          }}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
        >
          Add Season
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6 space-y-4"
        >
          <h3 className="font-semibold">
            {editingId ? "Edit Season" : "New Season"}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. 2026 Build Season"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                End Date
              </label>
              <input
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              {editingId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : seasons.length === 0 ? (
        <p className="text-slate-500 italic">No seasons configured.</p>
      ) : (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Start
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  End
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
              {seasons.map((s) => {
                const isCurrent = s.startDate <= today && s.endDate >= today;
                return (
                  <tr
                    key={s.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{s.startDate}</td>
                    <td className="px-4 py-3">{s.endDate}</td>
                    <td className="px-4 py-3">
                      {isCurrent ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">
                          Current
                        </span>
                      ) : s.endDate < today ? (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
                          Past
                        </span>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Upcoming
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => startEdit(s)}
                        className="text-sm text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSeason(s.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
