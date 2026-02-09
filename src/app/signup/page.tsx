"use client";

import { useState, useEffect } from "react";
import { formatDate, formatTime } from "@/lib/utils";

interface Shift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  signups: { id: number; mentor: { name: string } }[];
}

export default function SignupPage() {
  const [step, setStep] = useState<"info" | "shifts" | "done">("info");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mentorId, setMentorId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/shifts")
      .then((r) => r.json())
      .then((data) => setShifts(data.shifts || []))
      .catch(() => setError("Failed to load shifts"));
  }, []);

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/mentors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMentorId(data.id);
      setStep("shifts");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  function toggleShift(shiftId: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(shiftId)) {
        next.delete(shiftId);
      } else {
        next.set(shiftId, "");
      }
      return next;
    });
  }

  function setNote(shiftId: number, note: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(shiftId, note);
      return next;
    });
  }

  async function handleSignup() {
    if (!mentorId || selected.size === 0) return;
    setLoading(true);
    setError("");

    try {
      const results = [];
      for (const [shiftId, note] of selected) {
        const res = await fetch("/api/signups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mentorId, shiftId, note }),
        });
        const data = await res.json();
        if (!res.ok && res.status !== 409) throw new Error(data.error);
        results.push(data);
      }
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  // Group shifts by date
  const shiftsByDate = shifts.reduce<Record<string, Shift[]>>((acc, shift) => {
    if (!acc[shift.date]) acc[shift.date] = [];
    acc[shift.date].push(shift);
    return acc;
  }, {});

  if (step === "done") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">&#10003;</div>
        <h1 className="text-3xl font-bold mb-4">You&apos;re signed up!</h1>
        <p className="text-slate-600 mb-8">
          Thanks, {name}! You&apos;ve been signed up for {selected.size}{" "}
          shift{selected.size !== 1 ? "s" : ""}.
        </p>
        <button
          onClick={() => {
            setStep("info");
            setSelected(new Map());
          }}
          className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors"
        >
          Sign Up for More
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Sign Up for Shifts</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {step === "info" && (
        <form onSubmit={handleIdentify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              placeholder="John Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              placeholder="john@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Continue"}
          </button>
        </form>
      )}

      {step === "shifts" && (
        <div>
          <p className="text-slate-600 mb-6">
            Welcome, <strong>{name}</strong>! Select the shifts you&apos;ll attend
            and optionally add a note.
          </p>

          {Object.keys(shiftsByDate).length === 0 ? (
            <p className="text-slate-500 italic">
              No upcoming shifts available. Ask an admin to create some!
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(shiftsByDate).map(([date, dateShifts]) => (
                <div key={date}>
                  <h3 className="font-semibold text-lg mb-2 text-navy">
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-2">
                    {dateShifts.map((shift) => {
                      const isSelected = selected.has(shift.id);
                      return (
                        <div
                          key={shift.id}
                          className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                            isSelected
                              ? "border-primary bg-accent-bg"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                          onClick={() => toggleShift(shift.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">
                                {formatTime(shift.startTime)} -{" "}
                                {formatTime(shift.endTime)}
                              </span>
                              {shift.label && (
                                <span className="ml-2 text-sm text-slate-500">
                                  ({shift.label})
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-slate-500">
                              {shift.signups.length} signed up
                            </span>
                          </div>
                          {shift.signups.length > 0 && (
                            <div className="mt-1 text-sm text-slate-400">
                              {shift.signups
                                .map((s) => s.mentor.name)
                                .join(", ")}
                            </div>
                          )}
                          {isSelected && (
                            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                placeholder="Add a note (optional) e.g. 'Bringing pizza'"
                                value={selected.get(shift.id) || ""}
                                onChange={(e) =>
                                  setNote(shift.id, e.target.value)
                                }
                                className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selected.size > 0 && (
            <div className="mt-8 sticky bottom-4">
              <button
                onClick={handleSignup}
                disabled={loading}
                className="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-lg font-semibold shadow-lg"
              >
                {loading
                  ? "Signing up..."
                  : `Sign Up for ${selected.size} Shift${
                      selected.size !== 1 ? "s" : ""
                    }`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
