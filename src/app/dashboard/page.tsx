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
    checkedInAt: string | null;
    virtual: boolean;
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
  tv,
}: {
  config: CountdownConfig;
  tv: boolean;
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
    <div className={`bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-3 sm:p-8 ${tv ? "mb-4 p-4" : "mb-6 sm:mb-8"} text-white shadow-lg flex-shrink-0`}>
      <h2 className={`${tv ? "text-xl" : "text-lg sm:text-2xl"} font-bold mb-2 text-center`}>{config.label}</h2>
      <div className="grid grid-cols-4 gap-1 sm:gap-4 max-w-2xl mx-auto">
        {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
          <div key={unit} className="text-center">
            <div className={`${tv ? "text-5xl" : "text-2xl sm:text-5xl"} font-bold mb-1`}>{timeRemaining[unit]}</div>
            <div className={`${tv ? "text-sm" : "text-xs sm:text-sm"} uppercase tracking-wider opacity-90`}>{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

// Isolated cleanup countdown — re-renders only itself every second
const CleanupCountdown = memo(function CleanupCountdown({
  currentShift,
  isLastShiftOfDay,
  soundMinutes,
  displayMinutes,
  soundVolume,
  tv,
}: {
  currentShift: ShiftWithSignups | null;
  isLastShiftOfDay: boolean;
  soundMinutes: number;
  displayMinutes: number;
  soundVolume: number;
  tv: boolean;
}) {
  const [cleanupSeconds, setCleanupSeconds] = useState<number | null>(null);
  const cleanupSoundPlayedRef = useRef<number | null>(null);

  useEffect(() => {
    function getSecondsUntilShiftEnd(): number | null {
      if (!currentShift) return null;
      if (!isLastShiftOfDay) return null;

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
        secs <= soundMinutes * 60 &&
        currentShift &&
        cleanupSoundPlayedRef.current !== currentShift.id
      ) {
        cleanupSoundPlayedRef.current = currentShift.id;
        const audio = new Audio("/api/cleanup-sound");
        audio.volume = soundVolume;
        audio.play().catch(() => {});
      }

      if (secs !== null && secs <= displayMinutes * 60) {
        setCleanupSeconds(secs);
      } else {
        setCleanupSeconds(null);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentShift, isLastShiftOfDay, soundMinutes, displayMinutes, soundVolume]);

  if (cleanupSeconds === null) return null;

  return (
    <div className={`bg-amber-500/20 border-2 border-amber-500 rounded-2xl p-4 sm:p-6 ${tv ? "mb-4" : "mb-6"} text-center animate-pulse flex-shrink-0`}>
      <div className={`text-amber-400 ${tv ? "text-lg" : "text-base sm:text-lg"} font-semibold uppercase tracking-wider mb-1`}>
        Cleanup Time
      </div>
      <div className={`${tv ? "text-5xl" : "text-3xl sm:text-5xl"} font-bold text-white`}>
        {Math.floor(cleanupSeconds / 60)}:{(cleanupSeconds % 60).toString().padStart(2, "0")}
      </div>
    </div>
  );
});

function MentorAvatar({
  mentor,
  tv,
}: {
  mentor: { id: number; name: string; avatarPath: string };
  tv: boolean;
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

  const size = tv ? "w-10 h-10" : "w-8 h-8";
  const textSize = tv ? "text-lg" : "text-sm";

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
        className={`${size} rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary-light transition-all overflow-hidden`}
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
          <div className={`w-full h-full bg-primary-light/30 flex items-center justify-center text-primary-light font-bold ${textSize}`}>
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
  tv,
  onCheckIn,
}: {
  shift: ShiftWithSignups | null;
  title: string;
  isCurrent?: boolean;
  tv: boolean;
  onCheckIn?: (signupId: number) => void;
}) {
  if (!shift) {
    return (
      <div className={`bg-slate-800 rounded-2xl ${tv ? "p-6 flex flex-col" : "p-5 sm:p-8"} flex-1 min-h-0`}>
        <h2 className={`${tv ? "text-2xl" : "text-xl sm:text-2xl"} font-bold text-slate-400 mb-4 flex-shrink-0`}>{title}</h2>
        <p className={`text-slate-500 ${tv ? "text-xl" : "text-lg sm:text-xl"}`}>No shift scheduled</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl ${tv ? "p-6 flex flex-col" : "p-5 sm:p-8"} flex-1 min-h-0 ${
        isCurrent
          ? "bg-primary-light/15 border-2 border-primary-light"
          : "bg-slate-800"
      }`}
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className={`${tv ? "text-2xl" : "text-xl sm:text-2xl"} font-bold text-white`}>{title}</h2>
        {isCurrent && (
          <span className={`bg-primary-light text-primary-dark ${tv ? "text-base px-4 py-1.5" : "text-xs sm:text-sm px-2 sm:px-3 py-1"} font-bold rounded-full animate-pulse`}>
            LIVE
          </span>
        )}
      </div>
      <div className={`${tv ? "text-2xl" : "text-xl sm:text-3xl"} font-bold text-white mb-1 flex-shrink-0`}>
        {formatTimeDashboard(shift.startTime)} - {formatTimeDashboard(shift.endTime)}
      </div>
      <div className={`${tv ? "text-lg" : "text-base sm:text-xl"} text-slate-400 mb-2 flex-shrink-0`}>
        {formatDateDashboard(shift.date)}
      </div>
      {shift.label && (
        <div className={`${tv ? "text-base" : "text-base sm:text-lg"} text-primary-light mb-4 flex-shrink-0`}>{shift.label}</div>
      )}

      <div className={`mt-4 ${tv ? "flex-1 min-h-0 flex flex-col" : "mt-6"}`}>
        <div className={`${tv ? "text-sm" : "text-xs sm:text-sm"} text-slate-400 uppercase tracking-wider mb-3 flex-shrink-0`}>
          Mentors ({shift.signups.length})
        </div>
        {shift.signups.length === 0 ? (
          <p className="text-slate-500 italic">No one signed up yet</p>
        ) : (
          <div className={`grid gap-2 ${tv ? "grid-cols-2 gap-3 flex-1 min-h-0 overflow-auto" : "grid-cols-1 sm:grid-cols-2"}`}>
            {shift.signups.map((signup) => (
              <div
                key={signup.id}
                onClick={() => {
                  if (isCurrent && onCheckIn && !signup.checkedInAt) {
                    onCheckIn(signup.id);
                  }
                }}
                className={`flex items-center gap-2 rounded-lg ${tv ? "px-4 py-3" : "px-2.5 py-2 sm:px-3"} ${
                  signup.checkedInAt
                    ? "bg-green-900/30 border border-green-700/50"
                    : isCurrent && onCheckIn
                      ? "bg-slate-700/50 cursor-pointer hover:bg-slate-600/50 transition-colors"
                      : "bg-slate-700/50"
                }`}
                title={
                  signup.checkedInAt
                    ? `Checked in at ${new Date(signup.checkedInAt).toLocaleTimeString()}`
                    : isCurrent && onCheckIn
                      ? "Tap to check in"
                      : undefined
                }
              >
                <MemoMentorAvatar mentor={signup.mentor} tv={tv} />
                <div className="min-w-0 flex-1">
                  <div className={`text-white font-medium truncate flex items-center gap-1.5 ${tv ? "text-base" : "text-sm"}`}>
                    {signup.mentor.name}
                    {signup.virtual && (
                      <span className={`flex-shrink-0 bg-blue-500/20 text-blue-300 rounded px-1 ${tv ? "text-xs" : "text-[10px]"}`}>
                        Virtual
                      </span>
                    )}
                  </div>
                  {(signup.customStartTime || signup.customEndTime) && (
                    <div className={`${tv ? "text-sm" : "text-xs"} text-slate-400`}>
                      {formatTimeDashboard(signup.customStartTime || shift.startTime)} - {formatTimeDashboard(signup.customEndTime || shift.endTime)}
                    </div>
                  )}
                  {signup.note && (
                    <div className={`${tv ? "text-sm" : "text-xs"} text-slate-400 truncate`}>{signup.note}</div>
                  )}
                </div>
                {signup.checkedInAt ? (
                  <span className={`flex-shrink-0 text-green-400 ${tv ? "text-xl" : "text-base"}`} title="Checked in">&#10003;</span>
                ) : isCurrent && onCheckIn ? (
                  <span className={`flex-shrink-0 text-slate-500 ${tv ? "text-sm" : "text-xs"}`}>tap</span>
                ) : null}
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
  const [futureShifts, setFutureShifts] = useState<ShiftWithSignups[]>([]);
  const [browseIndex, setBrowseIndex] = useState<number | null>(null);
  const [isLastShiftOfDay, setIsLastShiftOfDay] = useState(false);
  const [cleanupConfig, setCleanupConfig] = useState({ soundMinutes: 20, displayMinutes: 10, soundVolume: 0.5 });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [branding, setBranding] = useState<Branding>({ appName: "Workshop Dashboard", logoPath: "" });
  const [countdown, setCountdown] = useState<CountdownConfig>({ enabled: false, targetDate: "", label: "" });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [zoom, setZoom] = useState(100);
  const [tvMode, setTvMode] = useState(false);
  const [goals, setGoals] = useState("");
  const [goalsSaved, setGoalsSaved] = useState(false);
  const [goalsEnabled, setGoalsEnabled] = useState(true);
  const [announcement, setAnnouncement] = useState<{ enabled: boolean; text: string }>({ enabled: false, text: "" });
  const prevShiftIdRef = useRef<number | null | undefined>(undefined);
  const goalsSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const buildTapRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

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
          audio.volume = data.cleanupConfig?.soundVolume ?? 0.5;
          await audio.play();
        } catch {
          // No sound configured or autoplay blocked
        }
      }
      prevShiftIdRef.current = newShiftId;

      setCurrentShift(data.currentShift);
      setNextShift(data.nextShift);
      if (data.futureShifts) setFutureShifts(data.futureShifts);
      if (data.isLastShiftOfDay !== undefined) setIsLastShiftOfDay(data.isLastShiftOfDay);
      if (data.cleanupConfig) setCleanupConfig(data.cleanupConfig);
      setLastUpdate(new Date());

      // Update non-shift data from the consolidated response
      if (data.branding) setBranding(data.branding);
      if (data.countdown) setCountdown(data.countdown);
      if (data.quote !== undefined) setQuote(data.quote);
      if (data.goals !== undefined) setGoals(data.goals);
      if (data.goalsEnabled !== undefined) setGoalsEnabled(data.goalsEnabled);
      if (data.announcement) setAnnouncement(data.announcement);
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

  // Cleanup idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Auto-enter TV + fullscreen mode when ?tv=1 is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "1") {
      setTvMode(true);
      setZoom(70);
      document.documentElement.requestFullscreen().catch(() => {});
      // Clean up the URL
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  // Fullscreen state tracking — hide nav bar when fullscreen
  useEffect(() => {
    function handleFullscreenChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      const nav = document.getElementById("main-nav");
      if (nav) nav.style.display = fs ? "none" : "";
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      // Restore nav if component unmounts while fullscreen
      const nav = document.getElementById("main-nav");
      if (nav) nav.style.display = "";
    };
  }, []);

  // Wake lock — keep screen awake while today has remaining shifts
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const hasShiftsToday = !!currentShift || (!!nextShift && nextShift.date === todayStr);

    async function requestWakeLock() {
      if (wakeLockRef.current) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        // Permission denied or not supported
      }
    }

    function releaseWakeLock() {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    }

    // Re-acquire wake lock when tab becomes visible again
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && hasShiftsToday) {
        requestWakeLock();
      }
    }

    if (hasShiftsToday) {
      requestWakeLock();
      document.addEventListener("visibilitychange", handleVisibilityChange);
    } else {
      releaseWakeLock();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [currentShift, nextShift]);

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

  const handleCheckIn = useCallback(async (signupId: number) => {
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupId }),
      });
      if (res.ok) {
        const data = await res.json();
        const checkedInAt = data.checkedInAt || new Date().toISOString();
        const allIds = new Set<number>([signupId, ...(data.alsoCheckedIn || [])]);

        // Update local state immediately for all auto-checked-in signups
        const markCheckedIn = (signups: ShiftWithSignups["signups"]) =>
          signups.map((s) => allIds.has(s.id) ? { ...s, checkedInAt } : s);

        setCurrentShift((prev) => prev ? { ...prev, signups: markCheckedIn(prev.signups) } : prev);
        setNextShift((prev) => prev ? { ...prev, signups: markCheckedIn(prev.signups) } : prev);
        setFutureShifts((prev) => prev.map((shift) => ({ ...shift, signups: markCheckedIn(shift.signups) })));
      }
    } catch {
      // Silent fail
    }
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  // Shift browsing navigation
  function resetIdleTimer() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setBrowseIndex(null), 2 * 60 * 1000);
  }

  function browseForward() {
    setBrowseIndex((prev) => {
      if (prev === null) return 0;
      const maxIndex = futureShifts.length - 1;
      return prev < maxIndex ? prev + 1 : prev;
    });
    resetIdleTimer();
  }

  function browseBack() {
    setBrowseIndex((prev) => {
      if (prev === null || prev === 0) return null;
      return prev - 1;
    });
    resetIdleTimer();
  }

  // Compute which shifts to display
  const canBrowse = futureShifts.length > 0;
  const isBrowsing = browseIndex !== null;
  let displayLeft: ShiftWithSignups | null;
  let displayRight: ShiftWithSignups | null;
  let displayLeftTitle: string;
  let displayRightTitle: string;

  if (isBrowsing) {
    displayLeft = futureShifts[browseIndex] || null;
    displayRight = futureShifts[browseIndex + 1] || null;
    displayLeftTitle = "Upcoming Shift";
    displayRightTitle = "Following Shift";
  } else {
    displayLeft = currentShift;
    displayRight = nextShift;
    displayLeftTitle = "Current Shift";
    displayRightTitle = "Next Shift";
  }

  const canGoBack = isBrowsing;
  const canGoForward = canBrowse && (browseIndex === null || browseIndex < futureShifts.length - 1);

  return (
    <div className={`bg-navy-dark text-white ${tvMode ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      <div className={`${tvMode ? "p-6 h-full flex flex-col" : "p-4 sm:p-8 max-w-6xl"} mx-auto`} style={{ zoom: `${zoom}%` }}>
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${tvMode ? "mb-4" : "mb-6 sm:mb-8"} flex-shrink-0`}>
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {branding.logoPath && (
              <img src="/api/logo" alt="" className={`${tvMode ? "h-12" : "h-8 sm:h-12"} w-auto flex-shrink-0`} />
            )}
            <h1 className={`${tvMode ? "text-3xl" : "text-2xl sm:text-4xl"} font-bold truncate`}>{branding.appName}</h1>
          </div>
          <div className={`${tvMode ? "text-base" : "text-xs sm:text-sm"} text-slate-500 flex-shrink-0`}>
            {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        {announcement.enabled && announcement.text && (
          <div className={`bg-amber-500 rounded-2xl ${tvMode ? "p-4 mb-4" : "p-4 sm:p-6 mb-6 sm:mb-8"} text-center flex-shrink-0`}>
            <p className={`text-white font-bold ${tvMode ? "text-xl" : "text-base sm:text-lg"}`}>
              {announcement.text}
            </p>
          </div>
        )}

        <CountdownTimer config={countdown} tv={tvMode} />
        <CleanupCountdown
          currentShift={currentShift}
          isLastShiftOfDay={isLastShiftOfDay}
          soundMinutes={cleanupConfig.soundMinutes}
          displayMinutes={cleanupConfig.displayMinutes}
          soundVolume={cleanupConfig.soundVolume}
          tv={tvMode}
        />

        {/* Shift Cards with Navigation */}
        <div className={`flex items-stretch gap-2 ${tvMode ? "flex-1 min-h-0" : ""}`}>
          {/* Back arrow */}
          <button
            onClick={browseBack}
            disabled={!canGoBack}
            className={`flex-shrink-0 flex items-center justify-center px-3 min-w-[44px] min-h-[44px] rounded-xl transition-colors ${
              canGoBack
                ? "text-white hover:bg-slate-700 cursor-pointer"
                : "text-slate-700 cursor-default"
            }`}
            title="Previous shifts"
          >
            <span className="text-2xl sm:text-3xl">&lsaquo;</span>
          </button>

          {/* Shift cards */}
          <div
            className={`flex-1 flex flex-col lg:flex-row gap-4 min-w-0 ${tvMode ? "min-h-0" : "sm:gap-6"}`}
            onTouchStart={(e) => { touchStartRef.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartRef.current === null) return;
              const diff = touchStartRef.current - e.changedTouches[0].clientX;
              touchStartRef.current = null;
              if (Math.abs(diff) < 50) return;
              if (diff > 0 && canGoForward) browseForward();
              if (diff < 0 && canGoBack) browseBack();
            }}
          >
            {/* Browse indicator */}
            {isBrowsing && (
              <div className="text-center text-xs text-slate-500 lg:hidden mb-1">
                Viewing future shifts &middot; <button onClick={() => setBrowseIndex(null)} className="underline hover:text-slate-300">Back to now</button>
              </div>
            )}
            <ShiftCard
              shift={displayLeft}
              title={displayLeftTitle}
              isCurrent={!isBrowsing && !!currentShift}
              tv={tvMode}
              onCheckIn={!isBrowsing ? handleCheckIn : undefined}
            />
            <ShiftCard shift={displayRight} title={displayRightTitle} tv={tvMode} />
          </div>

          {/* Forward arrow */}
          <button
            onClick={browseForward}
            disabled={!canGoForward}
            className={`flex-shrink-0 flex items-center justify-center px-3 min-w-[44px] min-h-[44px] rounded-xl transition-colors ${
              canGoForward
                ? "text-white hover:bg-slate-700 cursor-pointer"
                : "text-slate-700 cursor-default"
            }`}
            title="Next shifts"
          >
            <span className="text-2xl sm:text-3xl">&rsaquo;</span>
          </button>
        </div>

        {/* Goals + Quote row */}
        {tvMode ? (
          <div className="flex gap-4 mt-4 flex-shrink-0">
            {goalsEnabled && (
              <div className="flex-[2] bg-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-white">Today&apos;s Goals</h2>
                  {goalsSaved && (
                    <span className="text-xs text-green-400">Saved</span>
                  )}
                </div>
                <textarea
                  value={goals}
                  onChange={(e) => handleGoalsChange(e.target.value)}
                  placeholder="What are we working on today?"
                  rows={2}
                  className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2 text-base placeholder-slate-500 border border-slate-600 focus:border-primary-light focus:ring-1 focus:ring-primary-light outline-none resize-none"
                />
              </div>
            )}
            {quote && (
              <div
                onClick={async () => {
                  try {
                    const res = await fetch("/api/quote?random=true");
                    const data = await res.json();
                    if (data.quote) setQuote(data.quote);
                  } catch { /* ignore */ }
                }}
                className="flex-1 bg-slate-800/50 rounded-2xl p-4 flex flex-col justify-center text-center cursor-pointer hover:bg-slate-800/70 transition-colors"
              >
                <p className="text-lg text-slate-300 italic">
                  &ldquo;{quote.text}&rdquo;
                </p>
                {quote.author && (
                  <p className="text-sm text-slate-500 mt-1">&mdash; {quote.author}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Goals */}
            {goalsEnabled && (
              <div className="mt-6 sm:mt-8 bg-slate-800 rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base sm:text-lg font-semibold text-white">Today&apos;s Goals</h2>
                  {goalsSaved && (
                    <span className="text-xs text-green-400">Saved</span>
                  )}
                </div>
                <textarea
                  value={goals}
                  onChange={(e) => handleGoalsChange(e.target.value)}
                  placeholder="What are we working on today?"
                  rows={4}
                  className="w-full bg-slate-700/50 text-white rounded-lg px-3 sm:px-4 py-3 text-base sm:text-lg placeholder-slate-500 border border-slate-600 focus:border-primary-light focus:ring-1 focus:ring-primary-light outline-none resize-none"
                />
              </div>
            )}

            {/* Quote */}
            {quote && (
              <div
                onClick={async () => {
                  try {
                    const res = await fetch("/api/quote?random=true");
                    const data = await res.json();
                    if (data.quote) setQuote(data.quote);
                  } catch { /* ignore */ }
                }}
                className="mt-6 sm:mt-8 bg-slate-800/50 rounded-2xl p-4 sm:p-6 text-center cursor-pointer hover:bg-slate-800/70 transition-colors"
              >
                <p className="text-base sm:text-xl text-slate-300 italic">
                  &ldquo;{quote.text}&rdquo;
                </p>
                {quote.author && (
                  <p className="text-xs sm:text-sm text-slate-500 mt-2">&mdash; {quote.author}</p>
                )}
              </div>
            )}

            {/* Build info */}
            {process.env.NEXT_PUBLIC_GIT_COMMIT && (
              <div
                className="mt-8 text-right text-xs text-slate-600 cursor-default select-none"
                onClick={() => {
                  const t = buildTapRef.current;
                  t.count++;
                  if (t.timer) clearTimeout(t.timer);
                  if (t.count >= 8) {
                    t.count = 0;
                    window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
                  } else {
                    t.timer = setTimeout(() => { t.count = 0; }, 2000);
                  }
                }}
              >
                Build: {process.env.NEXT_PUBLIC_GIT_COMMIT}
              </div>
            )}
          </>
        )}

        {/* Controls */}
        <div className={`flex items-center justify-center gap-2 sm:gap-3 ${tvMode ? "mt-4" : "mt-6 sm:mt-8"} flex-shrink-0`}>
          <div className="hidden sm:flex items-center bg-slate-700 rounded-lg">
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
            onClick={() => {
              const next = !tvMode;
              setTvMode(next);
              setZoom(next ? 70 : 100);
            }}
            className={`${tvMode ? "bg-primary text-white" : "bg-slate-700 text-white"} hover:bg-slate-600 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm font-semibold`}
            title={tvMode ? "Switch to Desktop view" : "Switch to TV view"}
          >
            TV
          </button>
          <button
            onClick={toggleFullscreen}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <span className="text-lg">&#x26F6;</span>
            <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
