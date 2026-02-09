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
}

interface Signup {
  id: number;
  note: string;
  shift: Shift;
}

interface Mentor {
  id: number;
  name: string;
  email: string;
}

export default function MyShiftsPage() {
  const [email, setEmail] = useState("");
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingMentors, setExistingMentors] = useState<Mentor[]>([]);

  useEffect(() => {
    fetch("/api/mentors")
      .then((r) => r.json())
      .then((data) => setExistingMentors(data.mentors || []))
      .catch(() => {});
  }, []);

  function handleSelectMentor(mentorIdStr: string) {
    if (!mentorIdStr) {
      setEmail("");
      setMentor(null);
      setSignups([]);
      return;
    }
    const selectedMentor = existingMentors.find(
      (m) => m.id === Number(mentorIdStr)
    );
    if (selectedMentor) {
      setEmail(selectedMentor.email);
      loadShifts(selectedMentor.email);
    }
  }

  async function loadShifts(mentorEmail: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/mentors?email=${encodeURIComponent(mentorEmail)}`);
      if (!res.ok) {
        throw new Error("Mentor not found");
      }
      const data = await res.json();
      setMentor(data);

      // Filter out past and cancelled shifts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      const upcomingSignups = (data.signups || []).filter(
        (signup: Signup) => !signup.shift.cancelled && signup.shift.date >= todayStr
      );
      setSignups(upcomingSignups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shifts");
      setMentor(null);
      setSignups([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    await loadShifts(email);
  }

  const calendarUrl = mentor ? `/api/calendar?email=${encodeURIComponent(mentor.email)}` : "";
  const googleCalendarUrl = mentor
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
        typeof window !== "undefined" ? window.location.origin + calendarUrl : ""
      )}`
    : "";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Shifts</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        {existingMentors.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Select your name
            </label>
            <select
              onChange={(e) => handleSelectMentor(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              defaultValue=""
            >
              <option value="">Select your name...</option>
              {existingMentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-slate-500">
                  or enter your email
                </span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Your Email Address
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
            {loading ? "Loading..." : "View My Shifts"}
          </button>
        </form>
      </div>

      {mentor && (
        <>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              Export to Calendar
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Add all your upcoming shifts to your calendar app
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
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

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Upcoming Shifts ({signups.length})
            </h2>

            {signups.length === 0 ? (
              <p className="text-slate-500 italic">
                You haven&apos;t signed up for any upcoming shifts yet.
              </p>
            ) : (
              <div className="space-y-3">
                {signups.map((signup) => (
                  <div
                    key={signup.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-primary transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg">
                          {formatTime(signup.shift.startTime)} -{" "}
                          {formatTime(signup.shift.endTime)}
                        </div>
                        <div className="text-slate-600">
                          {formatDate(signup.shift.date)}
                        </div>
                        {signup.shift.label && (
                          <div className="text-sm text-primary mt-1">
                            {signup.shift.label}
                          </div>
                        )}
                        {signup.note && (
                          <div className="text-sm text-slate-500 mt-2">
                            Note: {signup.note}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
