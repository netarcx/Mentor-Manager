"use client";

import { useState, useEffect } from "react";

interface ShiftWithSignups {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  signups: {
    id: number;
    note: string;
    mentor: { name: string };
  }[];
}

interface Branding {
  appName: string;
  logoPath: string;
}

function formatTimeDashboard(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatDateDashboard(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function ShiftCard({
  shift,
  title,
  isCurrent,
}: {
  shift: ShiftWithSignups | null;
  title: string;
  isCurrent?: boolean;
}) {
  if (!shift) {
    return (
      <div className="bg-slate-800 rounded-2xl p-8 flex-1">
        <h2 className="text-2xl font-bold text-slate-400 mb-4">{title}</h2>
        <p className="text-slate-500 text-xl">No shift scheduled</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-8 flex-1 ${
        isCurrent
          ? "bg-primary-light/15 border-2 border-primary-light"
          : "bg-slate-800"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {isCurrent && (
          <span className="bg-primary-light text-primary-dark text-sm font-bold px-3 py-1 rounded-full animate-pulse">
            LIVE
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">
        {formatTimeDashboard(shift.startTime)} - {formatTimeDashboard(shift.endTime)}
      </div>
      <div className="text-xl text-slate-400 mb-2">
        {formatDateDashboard(shift.date)}
      </div>
      {shift.label && (
        <div className="text-lg text-primary-light mb-4">{shift.label}</div>
      )}

      <div className="mt-6">
        <div className="text-sm text-slate-400 uppercase tracking-wider mb-3">
          Mentors ({shift.signups.length})
        </div>
        {shift.signups.length === 0 ? (
          <p className="text-slate-500 italic">No one signed up yet</p>
        ) : (
          <div className="space-y-2">
            {shift.signups.map((signup) => (
              <div
                key={signup.id}
                className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-4 py-3"
              >
                <div className="w-10 h-10 bg-primary-light/30 rounded-full flex items-center justify-center text-primary-light font-bold text-lg">
                  {signup.mentor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-medium text-lg">
                    {signup.mentor.name}
                  </div>
                  {signup.note && (
                    <div className="text-sm text-slate-400">{signup.note}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [currentShift, setCurrentShift] = useState<ShiftWithSignups | null>(
    null
  );
  const [nextShift, setNextShift] = useState<ShiftWithSignups | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [branding, setBranding] = useState<Branding>({ appName: "Workshop Dashboard", logoPath: "" });

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        setCurrentShift(data.currentShift);
        setNextShift(data.nextShift);
        setLastUpdate(new Date());
      } catch {
        // Silent fail on polling
      }
    }

    async function fetchBranding() {
      try {
        const res = await fetch("/api/branding");
        const data = await res.json();
        setBranding(data);
      } catch {
        // Use defaults
      }
    }

    fetchDashboard();
    fetchBranding();
    const interval = setInterval(
      fetchDashboard,
      parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "30000")
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-navy-dark text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {branding.logoPath && (
              <img src="/api/logo" alt="" className="h-12 w-auto" />
            )}
            <h1 className="text-4xl font-bold">{branding.appName} Dashboard</h1>
          </div>
          <div className="text-sm text-slate-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <ShiftCard
            shift={currentShift}
            title="Current Shift"
            isCurrent={true}
          />
          <ShiftCard shift={nextShift} title="Next Shift" />
        </div>
      </div>
    </div>
  );
}
