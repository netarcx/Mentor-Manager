"use client";

import { useState, useEffect } from "react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface Template {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
  active: boolean;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    dayOfWeek: 1,
    startTime: "18:00",
    endTime: "21:00",
    label: "",
  });
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState("");

  async function fetchTemplates() {
    const res = await fetch("/api/admin/templates");
    const data = await res.json();
    setTemplates(data.templates || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId
      ? `/api/admin/templates/${editingId}`
      : "/api/admin/templates";
    const method = editingId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setShowForm(false);
    setEditingId(null);
    setForm({ dayOfWeek: 1, startTime: "18:00", endTime: "21:00", label: "" });
    fetchTemplates();
  }

  async function toggleActive(template: Template) {
    await fetch(`/api/admin/templates/${template.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !template.active }),
    });
    fetchTemplates();
  }

  async function deleteTemplate(id: number) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
    fetchTemplates();
  }

  function startEdit(template: Template) {
    setForm({
      dayOfWeek: template.dayOfWeek,
      startTime: template.startTime,
      endTime: template.endTime,
      label: template.label,
    });
    setEditingId(template.id);
    setShowForm(true);
  }

  async function generateShifts(weeks: number) {
    setGenerating(true);
    setGenResult("");
    try {
      const res = await fetch("/api/admin/shifts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeksAhead: weeks }),
      });
      const data = await res.json();
      setGenResult(`Generated ${data.generated} new shifts!`);
    } catch {
      setGenResult("Failed to generate shifts");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Shift Templates</h1>
        <div className="flex gap-3">
          <button
            onClick={() => generateShifts(1)}
            disabled={generating}
            className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 text-sm"
          >
            {generating ? "Generating..." : "Generate 1 Week"}
          </button>
          <button
            onClick={() => generateShifts(4)}
            disabled={generating}
            className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50 text-sm"
          >
            {generating ? "Generating..." : "Generate 4 Weeks"}
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm({
                dayOfWeek: 1,
                startTime: "18:00",
                endTime: "21:00",
                label: "",
              });
            }}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm"
          >
            Add Template
          </button>
        </div>
      </div>

      {genResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {genResult}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6 space-y-4"
        >
          <h3 className="font-semibold">
            {editingId ? "Edit Template" : "New Template"}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Day of Week
              </label>
              <select
                value={form.dayOfWeek}
                onChange={(e) =>
                  setForm({ ...form, dayOfWeek: parseInt(e.target.value) })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                {DAYS.map((day, i) => (
                  <option key={i} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. Build Session"
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
      ) : templates.length === 0 ? (
        <p className="text-slate-500 italic">
          No templates yet. Create one to get started!
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Day
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Label
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
              {templates.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">
                    {DAYS[t.dayOfWeek]}
                  </td>
                  <td className="px-4 py-3">
                    {t.startTime} - {t.endTime}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {t.label || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(t)}
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        t.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => startEdit(t)}
                      className="text-sm text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
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
    </div>
  );
}
