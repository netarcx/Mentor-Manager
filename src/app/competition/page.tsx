"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// --- Types ---

interface MatchAlliance {
  team_keys: string[];
  score: number;
}

interface Match {
  key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  alliances: {
    red: MatchAlliance;
    blue: MatchAlliance;
  };
  predicted_time: number | null;
  time: number | null;
  actual_time: number | null;
  post_result_time: number | null;
  winning_alliance: string | null;
}

interface EventInfo {
  name: string;
  shortName: string;
  city: string;
  stateProv: string;
  country: string;
  startDate: string;
  endDate: string;
  year: number;
  eventTypeString: string;
  week: number | null;
}

interface TeamStatus {
  qual: {
    ranking: { rank: number; record: { wins: number; losses: number; ties: number } } | null;
    num_teams: number;
  } | null;
  alliance: { name: string; number: number; pick: number } | null;
  playoff: {
    level: string;
    status: string;
    record: { wins: number; losses: number; ties: number } | null;
  } | null;
  overall_status_str: string;
}

interface ChecklistItem {
  id: number;
  text: string;
  sortOrder: number;
}

interface Branding {
  appName: string;
  logoPath: string;
}

interface CompetitionData {
  enabled: boolean;
  event: EventInfo | null;
  matches: Match[];
  teamStatus: TeamStatus | null;
  checklist: {
    items: ChecklistItem[];
    checkedIds: number[];
  };
  branding: Branding;
  teamKey: string;
  pollInterval: number;
  robotImageSource: "none" | "tba" | "upload";
}

// --- Helpers ---

function getMatchLabel(match: Match): string {
  const level = match.comp_level;
  if (level === "qm") return `Qual ${match.match_number}`;
  const labels: Record<string, string> = {
    ef: "Eighths",
    qf: "Quarters",
    sf: "Semis",
    f: "Final",
  };
  const label = labels[level] || level.toUpperCase();
  return `${label} ${match.set_number}-${match.match_number}`;
}

function getTeamAlliance(match: Match, teamKey: string): "red" | "blue" | null {
  if (match.alliances.red.team_keys.includes(teamKey)) return "red";
  if (match.alliances.blue.team_keys.includes(teamKey)) return "blue";
  return null;
}

function isMatchCompleted(match: Match): boolean {
  return match.actual_time !== null && match.winning_alliance !== null;
}

function getMatchResult(match: Match, teamKey: string): "W" | "L" | "T" | null {
  if (!isMatchCompleted(match)) return null;
  const alliance = getTeamAlliance(match, teamKey);
  if (!alliance) return null;
  if (match.winning_alliance === "") return "T";
  if (match.winning_alliance === alliance) return "W";
  return "L";
}

function formatMatchTime(unixTimestamp: number | null): string {
  if (!unixTimestamp) return "--:--";
  const d = new Date(unixTimestamp * 1000);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
}

function formatCountdownShort(seconds: number): string {
  if (seconds <= 0) return "now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function teamNumberFromKey(teamKey: string): string {
  return teamKey.replace("frc", "");
}

// --- Components ---

function MatchCountdown({ targetTime }: { targetTime: number }) {
  const [seconds, setSeconds] = useState(() => {
    return Math.max(0, Math.floor(targetTime - Date.now() / 1000));
  });

  useEffect(() => {
    function tick() {
      setSeconds(Math.max(0, Math.floor(targetTime - Date.now() / 1000)));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return <span>{formatCountdownShort(seconds)}</span>;
}

function StatusBar({
  teamStatus,
  teamKey,
  nextMatch,
}: {
  teamStatus: TeamStatus | null;
  teamKey: string;
  nextMatch: Match | null;
}) {
  const ranking = teamStatus?.qual?.ranking;
  const numTeams = teamStatus?.qual?.num_teams;
  const record = ranking?.record;
  const alliance = teamStatus?.alliance;
  const nextTime = nextMatch?.predicted_time || nextMatch?.time || null;

  return (
    <div className="bg-slate-800/80 border-t border-slate-700 px-4 py-3 flex items-center justify-between gap-4 text-sm flex-shrink-0 flex-wrap">
      {/* Rank */}
      <div className="flex items-center gap-2">
        {ranking ? (
          <span className="text-slate-300">
            <span className="text-white font-bold text-base">Rank {ranking.rank}</span>
            {numTeams ? <span className="text-slate-500"> of {numTeams}</span> : null}
          </span>
        ) : (
          <span className="text-slate-500">No ranking yet</span>
        )}
      </div>

      {/* Record */}
      <div className="flex items-center gap-2">
        {record ? (
          <span className="text-slate-300">
            <span className="text-green-400 font-semibold">{record.wins}</span>
            <span className="text-slate-600">-</span>
            <span className="text-red-400 font-semibold">{record.losses}</span>
            <span className="text-slate-600">-</span>
            <span className="text-yellow-400 font-semibold">{record.ties}</span>
          </span>
        ) : (
          <span className="text-slate-500">0-0-0</span>
        )}
      </div>

      {/* Alliance (playoffs) */}
      {alliance && (
        <div className="text-slate-300">
          Alliance <span className="text-white font-bold">{alliance.number}</span>
          <span className="text-slate-500"> (Pick {alliance.pick})</span>
        </div>
      )}

      {/* Next match countdown */}
      <div className="flex items-center gap-2">
        {nextMatch && nextTime ? (
          <span className="text-slate-300">
            Next:{" "}
            <span className="text-white font-semibold">{getMatchLabel(nextMatch)}</span>{" "}
            in{" "}
            <span className="text-emerald-400 font-bold">
              <MatchCountdown targetTime={nextTime} />
            </span>
          </span>
        ) : (
          <span className="text-slate-500">
            {teamKey ? `Team ${teamNumberFromKey(teamKey)}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function CompetitionPage() {
  const [data, setData] = useState<CompetitionData | null>(null);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [robotImageError, setRobotImageError] = useState(false);
  const nextMatchRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pollIntervalRef = useRef(60);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/competition");
      const json = await res.json();
      if (json.enabled === false) {
        setData({ enabled: false } as CompetitionData);
      } else {
        setData(json);
        setCheckedIds(json.checklist?.checkedIds || []);
        if (json.pollInterval) pollIntervalRef.current = json.pollInterval;
      }
    } catch {
      // Silent fail on polling
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, pollIntervalRef.current * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  // TV mode via ?tv=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "1") {
      setZoom(100);
      document.documentElement.requestFullscreen().catch(() => {});
      window.history.replaceState({}, "", "/competition");
    }
  }, []);

  // Hide nav on mount (competition page always hides it)
  useEffect(() => {
    const nav = document.getElementById("main-nav");
    if (nav) nav.style.display = "none";
    return () => {
      const nav = document.getElementById("main-nav");
      if (nav) nav.style.display = "";
    };
  }, []);

  // Fullscreen state tracking
  useEffect(() => {
    function handleChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  // Wake lock
  useEffect(() => {
    if (!data?.enabled) return;

    async function requestWakeLock() {
      if (!("wakeLock" in navigator)) return;
      if (wakeLockRef.current) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        // Permission denied
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") requestWakeLock();
    }

    requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [data?.enabled]);

  // Determine next match
  const nextMatchIndex = useMemo(() => {
    if (!data?.matches) return -1;
    return data.matches.findIndex((m) => !isMatchCompleted(m));
  }, [data?.matches]);

  const nextMatch = useMemo(() => {
    if (!data?.matches || nextMatchIndex < 0) return null;
    return data.matches[nextMatchIndex];
  }, [data?.matches, nextMatchIndex]);

  // Auto-scroll to next match
  useEffect(() => {
    if (nextMatchRef.current) {
      nextMatchRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [nextMatchIndex]);

  // Checklist toggle
  async function handleToggleItem(itemId: number) {
    const newChecked = checkedIds.includes(itemId)
      ? checkedIds.filter((id) => id !== itemId)
      : [...checkedIds, itemId];
    setCheckedIds(newChecked);
    await fetch("/api/competition/checklist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkedIds: newChecked }),
    });
  }

  async function handleResetChecklist() {
    setCheckedIds([]);
    await fetch("/api/competition/checklist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkedIds: [] }),
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading competition data...</div>
      </div>
    );
  }

  if (!data || !data.enabled) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Competition Mode Not Configured</h1>
          <p className="text-slate-400">
            Set it up in <span className="text-slate-300 font-medium">Admin &gt; Competition</span>.
          </p>
        </div>
      </div>
    );
  }

  const event = data.event;
  const matches = data.matches || [];
  const checklistItems = data.checklist?.items || [];
  const teamKey = data.teamKey || "";
  const teamNumber = teamNumberFromKey(teamKey);
  const branding = data.branding;
  const checkedCount = checkedIds.length;
  const totalCount = checklistItems.length;

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden" style={{ zoom: `${zoom}%` }}>
      {/* Header */}
      <div className="bg-slate-800/90 border-b border-slate-700 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {branding.logoPath && (
            <img src="/api/logo" alt="" className="h-10 w-auto flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">
              {event ? event.name : branding.appName}
            </h1>
            {event && (
              <p className="text-xs text-slate-400 truncate">
                {event.city}, {event.stateProv} &middot; {event.eventTypeString}
                {event.week !== null && event.week !== undefined ? ` &middot; Week ${event.week}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {data.robotImageSource !== "none" && !robotImageError && (
            <img
              src="/api/robot-image"
              alt="Robot"
              className="h-12 w-12 rounded-lg object-cover bg-slate-700 flex-shrink-0"
              onError={() => setRobotImageError(true)}
            />
          )}
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight text-emerald-400">
              {teamNumber}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Team</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Match Schedule */}
        <div className="flex-[3] flex flex-col min-h-0 border-r border-slate-700/50">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Match Schedule
            </h2>
            <span className="text-xs text-slate-500">
              {matches.length} match{matches.length !== 1 ? "es" : ""}
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-30">&#x1F3C1;</div>
                <p className="text-slate-500 text-lg">No matches scheduled yet</p>
                <p className="text-slate-600 text-sm mt-1">Check back once the event begins</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {matches.map((match, index) => {
                const completed = isMatchCompleted(match);
                const isNext = index === nextMatchIndex;
                const alliance = getTeamAlliance(match, teamKey);
                const result = getMatchResult(match, teamKey);
                const redScore = match.alliances.red.score;
                const blueScore = match.alliances.blue.score;
                const scheduledTime = match.predicted_time || match.time;

                return (
                  <div
                    key={match.key}
                    ref={isNext ? nextMatchRef : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all ${
                      isNext
                        ? "bg-emerald-500/10 border border-emerald-500/50 shadow-lg shadow-emerald-500/5"
                        : completed
                          ? "bg-slate-800/30 opacity-60"
                          : "bg-slate-800/50"
                    }`}
                  >
                    {/* Alliance color bar */}
                    <div
                      className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                        alliance === "red"
                          ? "bg-red-500"
                          : alliance === "blue"
                            ? "bg-blue-500"
                            : "bg-slate-700"
                      }`}
                    />

                    {/* Match label */}
                    <div className="min-w-[5.5rem] flex-shrink-0">
                      <span className={`text-sm font-semibold ${isNext ? "text-emerald-400" : "text-slate-300"}`}>
                        {getMatchLabel(match)}
                      </span>
                    </div>

                    {/* Scores / Time */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      {completed ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className={`font-mono font-bold ${alliance === "red" ? "text-red-400" : "text-red-400/60"}`}>
                            {redScore}
                          </span>
                          <span className="text-slate-600">-</span>
                          <span className={`font-mono font-bold ${alliance === "blue" ? "text-blue-400" : "text-blue-400/60"}`}>
                            {blueScore}
                          </span>
                        </div>
                      ) : isNext ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {formatMatchTime(scheduledTime)}
                          </span>
                          {scheduledTime && (
                            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <MatchCountdown targetTime={scheduledTime} />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {formatMatchTime(scheduledTime)}
                        </span>
                      )}
                    </div>

                    {/* Result badge */}
                    <div className="w-8 flex-shrink-0 text-right">
                      {result === "W" && (
                        <span className="inline-block text-xs font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded">
                          W
                        </span>
                      )}
                      {result === "L" && (
                        <span className="inline-block text-xs font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded">
                          L
                        </span>
                      )}
                      {result === "T" && (
                        <span className="inline-block text-xs font-bold text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded">
                          T
                        </span>
                      )}
                      {isNext && !result && (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Pre-Match Checklist */}
        <div className="flex-[2] flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Pre-Match Checklist
            </h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              checkedCount === totalCount && totalCount > 0
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-slate-700 text-slate-400"
            }`}>
              {checkedCount}/{totalCount}
            </span>
          </div>

          {checklistItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <p className="text-slate-500 text-sm">No checklist items configured</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {checklistItems.map((item) => {
                const checked = checkedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleToggleItem(item.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-4 min-h-[3rem] transition-all text-left ${
                      checked
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-700 border border-slate-600"
                      }`}
                    >
                      {checked && (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        checked ? "text-emerald-300 line-through opacity-70" : "text-slate-200"
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Reset button */}
          {checklistItems.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-700/50 flex-shrink-0">
              <button
                onClick={handleResetChecklist}
                disabled={checkedCount === 0}
                className="w-full py-2.5 text-sm font-medium rounded-lg transition-colors bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Reset All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar teamStatus={data.teamStatus} teamKey={teamKey} nextMatch={nextMatch} />

      {/* Floating controls (bottom-right) */}
      <div className="fixed bottom-14 right-4 flex items-center gap-1.5 z-50">
        <button
          onClick={() => setZoom((z) => Math.max(40, z - 10))}
          className="w-8 h-8 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white text-sm font-bold transition-colors backdrop-blur-sm border border-slate-700/50"
          title="Zoom Out"
        >
          &minus;
        </button>
        <span className="text-[10px] text-slate-500 min-w-[2rem] text-center">{zoom}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(150, z + 10))}
          className="w-8 h-8 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white text-sm font-bold transition-colors backdrop-blur-sm border border-slate-700/50"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={toggleFullscreen}
          className="w-8 h-8 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white text-lg transition-colors backdrop-blur-sm border border-slate-700/50 flex items-center justify-center"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          &#x26F6;
        </button>
      </div>
    </div>
  );
}
