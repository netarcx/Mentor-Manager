"use client";

import { useState, useEffect } from "react";
import { formatDate, formatTime } from "@/lib/utils";

interface Shift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  cancelled: boolean;
  _count: { signups: number };
}

export default function BulkSignupPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<Set<number>>(new Set());
  const [namesText, setNamesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/shifts")
      .then((r) => r.json())
      .then((data) => setShifts((data.shifts || []).filter((s: Shift) => !s.cancelled)))
      .catch(() => setError("Failed to load shifts"))
      .finally(() => setLoading(false));
  }, []);

  function toggleShift(id: number) {
    setSelectedShifts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllShifts() {
    if (selectedShifts.size === shifts.length) {
      setSelectedShifts(new Set());
    } else {
      setSelectedShifts(new Set(shifts.map((s) => s.id)));
    }
  }

  const parsedNames = namesText
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedNames.length === 0 || selectedShifts.size === 0) return;

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/signups/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          names: parsedNames,
          shiftIds: Array.from(selectedShifts),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage(
        `Created ${data.created} signup${data.created !== 1 ? "s" : ""} for ${data.mentorCount} mentor${data.mentorCount !== 1 ? "s" : ""} across ${data.shiftCount} shift${data.shiftCount !== 1 ? "s" : ""}` +
          (data.skipped > 0 ? ` (${data.skipped} duplicates skipped)` : "")
      );
      setNamesText("");
      setSelectedShifts(new Set());

      // Refresh shift counts
      const refreshRes = await fetch("/api/admin/shifts");
      const refreshData = await refreshRes.json();
      setShifts((refreshData.shifts || []).filter((s: Shift) => !s.cancelled));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create signups");
    } finally {
      setSubmitting(false);
    }
  }

  // Group shifts by date
  const shiftsByDate = shifts.reduce<Record<string, Shift[]>>((acc, shift) => {
    if (!acc[shift.date]) acc[shift.date] = [];
    acc[shift.date].push(shift);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Bulk Signup</h1>
      <p className="text-slate-500 mb-6">
        Sign up multiple mentors for shifts at once. Paste one name per line.
      </p>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 max-w-3xl">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 max-w-3xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Names Input */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-3">Mentor Names</h2>
          <p className="text-sm text-slate-500 mb-3">
            Enter one name per line. New mentors will be created automatically.
          </p>
          <textarea
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            rows={8}
            className="w-full border border-slate-300 rounded-lg px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder={"John Smith\nJane Doe\nBob Johnson"}
          />
          {parsedNames.length > 0 && (
            <p className="text-sm text-slate-500 mt-2">
              {parsedNames.length} name{parsedNames.length !== 1 ? "s" : ""} entered
            </p>
          )}
        </div>

        {/* Shift Selection */}
        <div className="bg-white rounded-xl shadow border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Select Shifts</h2>
            {shifts.length > 0 && (
              <button
                type="button"
                onClick={selectAllShifts}
                className="text-sm text-primary hover:text-primary-dark underline"
              >
                {selectedShifts.size === shifts.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-slate-500">Loading shifts...</p>
          ) : Object.keys(shiftsByDate).length === 0 ? (
            <p className="text-slate-500 italic">No active shifts available.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(shiftsByDate).map(([date, dateShifts]) => (
                <div key={date}>
                  <h3 className="font-medium text-sm text-navy mb-2">
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-1">
                    {dateShifts.map((shift) => (
                      <label
                        key={shift.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          selectedShifts.has(shift.id)
                            ? "bg-accent-bg border border-primary"
                            : "border border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedShifts.has(shift.id)}
                          onChange={() => toggleShift(shift.id)}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="font-medium text-sm">
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </span>
                        {shift.label && (
                          <span className="text-sm text-slate-500">
                            ({shift.label})
                          </span>
                        )}
                        <span className="text-xs text-slate-400 ml-auto">
                          {shift._count.signups} signed up
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedShifts.size > 0 && (
            <p className="text-sm text-slate-500 mt-3">
              {selectedShifts.size} shift{selectedShifts.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* Summary & Submit */}
        {parsedNames.length > 0 && selectedShifts.size > 0 && (
          <div className="bg-accent-bg border border-primary rounded-xl p-4">
            <p className="text-sm font-medium">
              This will create up to{" "}
              <strong>{parsedNames.length * selectedShifts.size}</strong> signup
              {parsedNames.length * selectedShifts.size !== 1 ? "s" : ""} ({parsedNames.length}{" "}
              mentor{parsedNames.length !== 1 ? "s" : ""} &times; {selectedShifts.size} shift
              {selectedShifts.size !== 1 ? "s" : ""}). Duplicates will be skipped.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || parsedNames.length === 0 || selectedShifts.size === 0}
          className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 font-semibold"
        >
          {submitting
            ? "Creating signups..."
            : `Sign Up ${parsedNames.length || 0} Mentor${parsedNames.length !== 1 ? "s" : ""}`}
        </button>
      </form>
    </div>
  );
}
