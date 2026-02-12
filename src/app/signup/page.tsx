"use client";

import { useState, useEffect } from "react";
import { formatDate, formatTime, isWithinDays } from "@/lib/utils";
import { MIN_MENTOR_SIGNUPS } from "@/lib/constants";

interface Shift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  signups: { id: number; mentor: { id: number; name: string } }[];
}

interface Mentor {
  id: number;
  name: string;
  email: string;
}

export default function SignupPage() {
  const [step, setStep] = useState<"info" | "shifts" | "done">("info");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mentorId, setMentorId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [today, setToday] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [selected, setSelected] = useState<Map<number, { note: string; customStartTime: string; customEndTime: string }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingMentors, setExistingMentors] = useState<Mentor[]>([]);

  useEffect(() => {
    fetch("/api/shifts")
      .then((r) => r.json())
      .then((data) => {
        setShifts(data.shifts || []);
        setToday(data.today || "");
      })
      .catch(() => setError("Failed to load shifts"));

    fetch("/api/mentors")
      .then((r) => r.json())
      .then((data) => setExistingMentors(data.mentors || []))
      .catch(() => {});
  }, []);

  function handleSelectMentor(mentorIdStr: string) {
    if (!mentorIdStr) return;
    const mentor = existingMentors.find((m) => m.id === Number(mentorIdStr));
    if (mentor) {
      setName(mentor.name);
      setEmail(mentor.email);
    }
  }

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

  function toggleShift(shift: Shift) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(shift.id)) {
        next.delete(shift.id);
      } else {
        next.set(shift.id, { note: "", customStartTime: shift.startTime, customEndTime: shift.endTime });
      }
      return next;
    });
  }

  function updateSelection(shiftId: number, updates: Partial<{ note: string; customStartTime: string; customEndTime: string }>) {
    setSelected((prev) => {
      const next = new Map(prev);
      const current = next.get(shiftId);
      if (current) {
        next.set(shiftId, { ...current, ...updates });
      }
      return next;
    });
  }

  async function handleSignup() {
    if (!mentorId || selected.size === 0) return;
    setLoading(true);
    setError("");

    try {
      const signups = Array.from(selected, ([shiftId, data]) => {
        const shift = shifts.find((s) => s.id === shiftId);
        const hasCustomStart = shift && data.customStartTime !== shift.startTime;
        const hasCustomEnd = shift && data.customEndTime !== shift.endTime;
        return {
          shiftId,
          note: data.note,
          ...(hasCustomStart && { customStartTime: data.customStartTime }),
          ...(hasCustomEnd && { customEndTime: data.customEndTime }),
        };
      });

      const res = await fetch("/api/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId, signups }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  // Split shifts into upcoming and past
  const upcomingShifts = today ? shifts.filter((s) => s.date >= today) : shifts;
  const pastShifts = today ? shifts.filter((s) => s.date < today) : [];
  const visibleShifts = showPast ? shifts : upcomingShifts;

  // Group shifts by date
  const shiftsByDate = visibleShifts.reduce<Record<string, Shift[]>>((acc, shift) => {
    if (!acc[shift.date]) acc[shift.date] = [];
    acc[shift.date].push(shift);
    return acc;
  }, {});

  if (step === "done") {
    const calendarUrl = `/api/calendar?email=${encodeURIComponent(email)}`;
    const fullCalendarUrl = typeof window !== "undefined"
      ? `${window.location.origin}${calendarUrl}`
      : calendarUrl;
    const googleCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(fullCalendarUrl)}`;

    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">&#10003;</div>
        <h1 className="text-3xl font-bold mb-4">You&apos;re signed up!</h1>
        <p className="text-slate-600 mb-6">
          Thanks, {name}! You&apos;ve been signed up for {selected.size}{" "}
          shift{selected.size !== 1 ? "s" : ""}.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-lg mb-3">
            Add to Your Calendar
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Keep track of your shifts by adding them to your calendar
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={calendarUrl}
              download
              className="inline-flex items-center justify-center gap-2 bg-white border-2 border-primary text-primary px-6 py-3 rounded-lg hover:bg-primary hover:text-white transition-colors font-medium"
            >
              <span className="text-xl">&#128197;</span>
              Download Calendar (.ics)
            </a>
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white border-2 border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-600 hover:text-white transition-colors font-medium"
            >
              <span className="text-xl">&#128198;</span>
              Add to Google Calendar
            </a>
          </div>
        </div>

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
        <div>
          {existingMentors.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">
                Returning mentor?
              </label>
              <select
                onChange={(e) => handleSelectMentor(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                defaultValue=""
              >
                <option value="">Select your name...</option>
                {existingMentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name} ({mentor.email})
                  </option>
                ))}
              </select>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-2 text-slate-500">
                    or enter your info below
                  </span>
                </div>
              </div>
            </div>
          )}

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
        </div>
      )}

      {step === "shifts" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-slate-600">
              Welcome, <strong>{name}</strong>! Select the shifts you&apos;ll attend
              and optionally add a note.
            </p>
            <button
              onClick={() => {
                if (!showPast) {
                  // Lazy-load past shifts on first toggle
                  fetch("/api/shifts?includePast=true")
                    .then((r) => r.json())
                    .then((data) => setShifts(data.shifts || []))
                    .catch(() => {});
                }
                setShowPast(!showPast);
              }}
              className="text-sm text-slate-500 hover:text-slate-700 whitespace-nowrap ml-4 underline"
            >
              {showPast ? "Hide past shifts" : "Show past shifts"}
            </button>
          </div>

          {Object.keys(shiftsByDate).length === 0 ? (
            <p className="text-slate-500 italic">
              No upcoming shifts available. Ask an admin to create some!
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(shiftsByDate).map(([date, dateShifts]) => {
                const isPastDate = today && date < today;
                return (
                <div key={date}>
                  <h3 className={`font-semibold text-lg mb-2 ${isPastDate ? "text-slate-400" : "text-navy"}`}>
                    {formatDate(date)}
                    {isPastDate && <span className="ml-2 text-xs font-normal text-slate-400">(past)</span>}
                  </h3>
                  <div className="space-y-2">
                    {dateShifts.map((shift) => {
                      const isPast = today && shift.date < today;
                      const alreadySignedUp = mentorId !== null && shift.signups.some((s) => s.mentor.id === mentorId);
                      const isDisabled = isPast || alreadySignedUp;
                      const isSelected = !isDisabled && selected.has(shift.id);
                      const needsHelp = !isDisabled && shift.signups.length < MIN_MENTOR_SIGNUPS && isWithinDays(shift.date, 7);
                      return (
                        <div
                          key={shift.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            isPast
                              ? "border-slate-100 bg-slate-50 opacity-60"
                              : alreadySignedUp
                                ? "border-green-200 bg-green-50"
                                : isSelected
                                  ? "border-primary bg-accent-bg cursor-pointer"
                                  : needsHelp
                                    ? "border-amber-300 bg-amber-50 hover:border-amber-400 cursor-pointer"
                                    : "border-slate-200 hover:border-slate-300 cursor-pointer"
                          }`}
                          onClick={() => !isDisabled && toggleShift(shift)}
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
                            <span className={`text-sm ${alreadySignedUp ? "text-green-700 font-medium" : needsHelp ? "text-amber-700 font-medium" : "text-slate-500"}`}>
                              {shift.signups.length} signed up
                              {alreadySignedUp && (
                                <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">
                                  You&apos;re signed up
                                </span>
                              )}
                              {needsHelp && (
                                <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded">
                                  Needs mentors!
                                </span>
                              )}
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
                            <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-500 w-16">Arriving</label>
                                <input
                                  type="time"
                                  value={selected.get(shift.id)?.customStartTime || shift.startTime}
                                  min={shift.startTime}
                                  max={shift.endTime}
                                  onChange={(e) =>
                                    updateSelection(shift.id, { customStartTime: e.target.value })
                                  }
                                  className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                                <label className="text-xs text-slate-500 w-16">Leaving</label>
                                <input
                                  type="time"
                                  value={selected.get(shift.id)?.customEndTime || shift.endTime}
                                  min={shift.startTime}
                                  max={shift.endTime}
                                  onChange={(e) =>
                                    updateSelection(shift.id, { customEndTime: e.target.value })
                                  }
                                  className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                              </div>
                              <input
                                type="text"
                                placeholder="Add a note (optional) e.g. 'Bringing pizza'"
                                value={selected.get(shift.id)?.note || ""}
                                onChange={(e) =>
                                  updateSelection(shift.id, { note: e.target.value })
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
                );
              })}
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
