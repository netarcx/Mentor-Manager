"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";

interface ShiftWithSignups {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  signups: {
    id: number;
    note: string;
    customStartTime: string | null;
    customEndTime: string | null;
    mentor: { id: number; name: string; avatarPath: string };
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

// Isolated countdown timer — re-renders only itself every second
const CountdownTimer = memo(function CountdownTimer({
  config,
}: {
  config: CountdownConfig;
}) {
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!config.enabled || !config.targetDate) return;

    function updateCountdown() {
      const now = new Date();
      const target = new Date(config.targetDate + "T00:00:00");
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeRemaining({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [config]);

  if (!config.enabled || !config.targetDate) return null;

  return (
    <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-8 mb-8 text-white shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">{config.label}</h2>
      <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
        {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
          <div key={unit} className="text-center">
            <div className="text-5xl font-bold mb-2">{timeRemaining[unit]}</div>
            <div className="text-sm uppercase tracking-wider opacity-90">{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

// Isolated cleanup countdown — re-renders only itself every second
const CleanupCountdown = memo(function CleanupCountdown({
  currentShift,
  nextShift,
}: {
  currentShift: ShiftWithSignups | null;
  nextShift: ShiftWithSignups | null;
}) {
  const [cleanupSeconds, setCleanupSeconds] = useState<number | null>(null);
  const cleanupSoundPlayedRef = useRef<number | null>(null);

  useEffect(() => {
    function getSecondsUntilShiftEnd(): number | null {
      if (!currentShift) return null;
      if (nextShift && nextShift.date === currentShift.date) return null;

      const now = new Date();
      const [endH, endM] = currentShift.endTime.split(":").map(Number);
      const [year, month, day] = currentShift.date.split("-").map(Number);
      const endTime = new Date(year, month - 1, day, endH, endM, 0);
      const diff = Math.floor((endTime.getTime() - now.getTime()) / 1000);
      return diff > 0 ? diff : null;
    }

    function tick() {
      const secs = getSecondsUntilShiftEnd();

      if (
        secs !== null &&
        secs <= 20 * 60 &&
        currentShift &&
        cleanupSoundPlayedRef.current !== currentShift.id
      ) {
        cleanupSoundPlayedRef.current = currentShift.id;
        const audio = new Audio("/api/cleanup-sound");
        audio.volume = 0.3;
        audio.play().catch(() => {});
      }

      if (secs !== null && secs <= 10 * 60) {
        setCleanupSeconds(secs);
      } else {
        setCleanupSeconds(null);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentShift, nextShift]);

  if (cleanupSeconds === null) return null;

  return (
    <div className="bg-amber-500/20 border-2 border-amber-500 rounded-2xl p-6 mb-6 text-center animate-pulse">
      <div className="text-amber-400 text-lg font-semibold uppercase tracking-wider mb-1">
        Cleanup Time
      </div>
      <div className="text-5xl font-bold text-white">
        {Math.floor(cleanupSeconds / 60)}:{(cleanupSeconds % 60).toString().padStart(2, "0")}
      </div>
    </div>
  );
});

function MentorAvatar({
  mentor,
}: {
  mentor: { id: number; name: string; avatarPath: string };
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarKey, setAvatarKey] = useState(0);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch(`/api/mentors/${mentor.id}/avatar`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setAvatarKey((k) => k + 1);
      }
    } catch {
      // Silent fail
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary-light transition-all overflow-hidden"
        title="Click to set profile picture"
      >
        {mentor.avatarPath ? (
          <img
            key={avatarKey}
            src={`/api/mentors/${mentor.id}/avatar?v=${avatarKey}`}
            alt={mentor.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-primary-light/30 flex items-center justify-center text-primary-light font-bold text-lg">
            {mentor.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </>
  );
}

const MemoMentorAvatar = memo(MentorAvatar);

const ShiftCard = memo(function ShiftCard({
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
                <MemoMentorAvatar mentor={signup.mentor} />
                <div>
                  <div className="text-white font-medium text-lg">
                    {signup.mentor.name}
                    {(signup.customStartTime || signup.customEndTime) && (
                      <span className="ml-2 text-sm font-normal text-slate-400">
                        {formatTimeDashboard(signup.customStartTime || shift.startTime)} - {formatTimeDashboard(signup.customEndTime || shift.endTime)}
                      </span>
                    )}
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
});

export default function DashboardPage() {
  const [currentShift, setCurrentShift] = useState<ShiftWithSignups | null>(null);
  const [nextShift, setNextShift] = useState<ShiftWithSignups | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [branding, setBranding] = useState<Branding>({ appName: "Workshop Dashboard", logoPath: "" });
  const [countdown, setCountdown] = useState<CountdownConfig>({ enabled: false, targetDate: "", label: "" });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [zoom, setZoom] = useState(100);
  const [goals, setGoals] = useState("");
  const [goalsSaved, setGoalsSaved] = useState(false);
  const prevShiftIdRef = useRef<number | null | undefined>(undefined);
  const goalsSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      const newShiftId = data.currentShift?.id ?? null;

      // Play sound on shift change (skip the very first load)
      if (
        prevShiftIdRef.current !== undefined &&
        newShiftId !== prevShiftIdRef.current
      ) {
        try {
          const audio = new Audio("/api/sound");
          audio.volume = 0.3;
          await audio.play();
        } catch {
          // No sound configured or autoplay blocked
        }
      }
      prevShiftIdRef.current = newShiftId;

      setCurrentShift(data.currentShift);
      setNextShift(data.nextShift);
      setLastUpdate(new Date());

      // Update non-shift data from the consolidated response
      if (data.branding) setBranding(data.branding);
      if (data.countdown) setCountdown(data.countdown);
      if (data.quote !== undefined) setQuote(data.quote);
      if (data.goals !== undefined) setGoals(data.goals);
    } catch {
      // Silent fail on polling
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const dashboardInterval = setInterval(
      fetchDashboard,
      parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "30000")
    );
    return () => clearInterval(dashboardInterval);
  }, [fetchDashboard]);

  // Fullscreen state tracking
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function handleGoalsChange(text: string) {
    setGoals(text);
    setGoalsSaved(false);
    if (goalsSaveTimeoutRef.current) clearTimeout(goalsSaveTimeoutRef.current);
    goalsSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/goals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        setGoalsSaved(true);
        setTimeout(() => setGoalsSaved(false), 2000);
      } catch {
        // Silent fail
      }
    }, 1000);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  return (
    <div className="min-h-screen bg-navy-dark text-white">
      <div className="p-8 max-w-6xl mx-auto" style={{ zoom: `${zoom}%` }}>
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
            <div className="flex items-center bg-slate-700 rounded-lg">
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="hover:bg-slate-600 text-white px-3 py-2 rounded-l-lg transition-colors text-sm font-bold"
                title="Zoom Out"
              >
                &minus;
              </button>
              <span className="text-xs text-slate-300 px-1 min-w-[3rem] text-center">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
                className="hover:bg-slate-600 text-white px-3 py-2 rounded-r-lg transition-colors text-sm font-bold"
                title="Zoom In"
              >
                +
              </button>
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

        <CountdownTimer config={countdown} />
        <CleanupCountdown currentShift={currentShift} nextShift={nextShift} />

        <div className="flex flex-col lg:flex-row gap-6">
          <ShiftCard
            shift={currentShift}
            title="Current Shift"
            isCurrent={true}
          />
          <ShiftCard shift={nextShift} title="Next Shift" />
        </div>

        <div className="mt-8 bg-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Today&apos;s Goals</h2>
            {goalsSaved && (
              <span className="text-xs text-green-400">Saved</span>
            )}
          </div>
          <textarea
            value={goals}
            onChange={(e) => handleGoalsChange(e.target.value)}
            placeholder="What are we working on today?"
            rows={4}
            className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-3 text-lg placeholder-slate-500 border border-slate-600 focus:border-primary-light focus:ring-1 focus:ring-primary-light outline-none resize-none"
          />
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
