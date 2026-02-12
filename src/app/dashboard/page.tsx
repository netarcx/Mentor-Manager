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

interface CountdownConfig {
  enabled: boolean;
  targetDate: string;
  label: string;
}

interface QuoteData {
  text: string;
  author: string;
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
  const [countdown, setCountdown] = useState<CountdownConfig>({ enabled: false, targetDate: "", label: "" });
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);

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

    async function fetchCountdown() {
      try {
        const res = await fetch("/api/countdown");
        const data = await res.json();
        setCountdown(data);
      } catch {
        // Use defaults
      }
    }

    async function fetchQuote() {
      try {
        const res = await fetch("/api/quote");
        const data = await res.json();
        setQuote(data.quote);
      } catch {
        // Use defaults
      }
    }

    fetchDashboard();
    fetchBranding();
    fetchCountdown();
    fetchQuote();
    const dashboardInterval = setInterval(
      fetchDashboard,
      parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "30000")
    );
    const quoteInterval = setInterval(fetchQuote, 3600000); // Refresh quote every hour
    return () => {
      clearInterval(dashboardInterval);
      clearInterval(quoteInterval);
    };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!countdown.enabled || !countdown.targetDate) return;

    function updateCountdown() {
      const now = new Date();
      const target = new Date(countdown.targetDate + "T00:00:00");
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Fullscreen state tracking
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen request failed
      });
    } else {
      document.exitFullscreen();
    }
  }

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
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <button
              onClick={toggleFullscreen}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <span className="text-lg">&#x26F6;</span>
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <span className="text-lg">&#x26F6;</span>
                  Fullscreen
                </>
              )}
            </button>
          </div>
        </div>

        {countdown.enabled && countdown.targetDate && (
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-8 mb-8 text-white shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-center">
              {countdown.label}
            </h2>
            <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">{timeRemaining.days}</div>
                <div className="text-sm uppercase tracking-wider opacity-90">Days</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">{timeRemaining.hours}</div>
                <div className="text-sm uppercase tracking-wider opacity-90">Hours</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">{timeRemaining.minutes}</div>
                <div className="text-sm uppercase tracking-wider opacity-90">Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">{timeRemaining.seconds}</div>
                <div className="text-sm uppercase tracking-wider opacity-90">Seconds</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <ShiftCard
            shift={currentShift}
            title="Current Shift"
            isCurrent={true}
          />
          <ShiftCard shift={nextShift} title="Next Shift" />
        </div>

        {quote && (
          <div
            onClick={async () => {
              try {
                const res = await fetch("/api/quote?random=true");
                const data = await res.json();
                if (data.quote) setQuote(data.quote);
              } catch { /* ignore */ }
            }}
            className="mt-8 bg-slate-800/50 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-800/70 transition-colors"
          >
            <p className="text-xl text-slate-300 italic">
              &ldquo;{quote.text}&rdquo;
            </p>
            {quote.author && (
              <p className="text-sm text-slate-500 mt-2">&mdash; {quote.author}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
