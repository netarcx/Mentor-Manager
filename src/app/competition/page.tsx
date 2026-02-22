"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";

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

interface BatteryInfo {
  id: number;
  label: string;
  currentStatus: string | null;
  statusSince: string | null;
  matchKey: string;
}

interface TeamRanking {
  rank: number;
  record: { wins: number; losses: number; ties: number };
}

interface CompetitionData {
  enabled: boolean;
  event: EventInfo | null;
  matches: Match[];
  teamStatus: TeamStatus | null;
  teamNames: Record<string, string>;
  teamRankings: Record<string, TeamRanking>;
  pitNotes: Record<string, string>;
  checklist: {
    items: ChecklistItem[];
    checkedIds: number[];
  };
  branding: Branding;
  teamKey: string;
  pollInterval: number;
  robotImageSource: "none" | "tba" | "upload";
  batteries: BatteryInfo[];
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

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "America/Chicago",
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span>{time}</span>;
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
  matchGap,
}: {
  teamStatus: TeamStatus | null;
  teamKey: string;
  nextMatch: Match | null;
  matchGap: number;
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

      {/* Match gap */}
      {matchGap > 0 && (
        <div>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {matchGap} match{matchGap !== 1 ? "es" : ""} away
          </span>
        </div>
      )}

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

function ExpandedNextMatch({
  match,
  teamKey,
  teamNames,
  teamRankings,
}: {
  match: Match;
  teamKey: string;
  teamNames: Record<string, string>;
  teamRankings: Record<string, TeamRanking>;
}) {
  const scheduledTime = match.predicted_time || match.time;
  const ourAlliance = getTeamAlliance(match, teamKey);

  function renderTeamRow(key: string) {
    const num = teamNumberFromKey(key);
    const name = teamNames[key] || "";
    const isUs = key === teamKey;
    const ranking = teamRankings[key];
    return (
      <div
        key={key}
        className={`flex items-baseline gap-2 ${isUs ? "text-white font-bold" : "text-slate-300"}`}
      >
        <span className="font-mono text-sm w-12 text-right">{num}</span>
        <span className={`text-sm truncate ${isUs ? "text-white" : "text-slate-400"}`}>
          {name}
        </span>
        {ranking && (
          <span className="text-xs text-slate-500 flex-shrink-0">
            #{ranking.rank} ({ranking.record.wins}-{ranking.record.losses}-{ranking.record.ties})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mx-3 mt-2 rounded-xl bg-slate-800/80 border border-emerald-500/40 shadow-lg shadow-emerald-500/5 overflow-hidden flex-shrink-0">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
        <span className="text-base font-bold text-emerald-400">{getMatchLabel(match)}</span>
        <div className="flex items-center gap-3">
          {scheduledTime && (
            <span className="text-emerald-400 font-semibold text-sm bg-emerald-500/10 px-2.5 py-1 rounded-full">
              in <MatchCountdown targetTime={scheduledTime} />
            </span>
          )}
          <span className="text-xs text-slate-400">
            ~{formatMatchTime(scheduledTime)}
          </span>
        </div>
      </div>

      {/* Alliances */}
      <div className="grid grid-cols-2 divide-x divide-slate-700/50">
        {/* Red alliance */}
        <div className={`px-4 py-3 space-y-1 ${ourAlliance === "red" ? "bg-red-500/5" : ""}`}>
          <div className="text-xs font-bold uppercase tracking-wider text-red-400 mb-1.5">Red Alliance</div>
          {match.alliances.red.team_keys.map(renderTeamRow)}
        </div>
        {/* Blue alliance */}
        <div className={`px-4 py-3 space-y-1 ${ourAlliance === "blue" ? "bg-blue-500/5" : ""}`}>
          <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1.5">Blue Alliance</div>
          {match.alliances.blue.team_keys.map(renderTeamRow)}
        </div>
      </div>
    </div>
  );
}

function ExpandedLastMatch({
  match,
  teamKey,
  teamNames,
  teamRankings,
}: {
  match: Match;
  teamKey: string;
  teamNames: Record<string, string>;
  teamRankings: Record<string, TeamRanking>;
}) {
  const ourAlliance = getTeamAlliance(match, teamKey);
  const result = getMatchResult(match, teamKey);
  const redScore = match.alliances.red.score;
  const blueScore = match.alliances.blue.score;

  const resultColor = result === "W" ? "text-green-400" : result === "L" ? "text-red-400" : "text-yellow-400";
  const borderColor = result === "W" ? "border-green-500/40 shadow-green-500/5" : result === "L" ? "border-red-500/40 shadow-red-500/5" : "border-yellow-500/40 shadow-yellow-500/5";
  const resultLabel = result === "W" ? "WIN" : result === "L" ? "LOSS" : "TIE";

  function renderTeamRow(key: string) {
    const num = teamNumberFromKey(key);
    const name = teamNames[key] || "";
    const isUs = key === teamKey;
    const ranking = teamRankings[key];
    return (
      <div
        key={key}
        className={`flex items-baseline gap-2 ${isUs ? "text-white font-bold" : "text-slate-300"}`}
      >
        <span className="font-mono text-sm w-12 text-right">{num}</span>
        <span className={`text-sm truncate ${isUs ? "text-white" : "text-slate-400"}`}>
          {name}
        </span>
        {ranking && (
          <span className="text-xs text-slate-500 flex-shrink-0">
            #{ranking.rank} ({ranking.record.wins}-{ranking.record.losses}-{ranking.record.ties})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`mx-3 mt-2 rounded-xl bg-slate-800/80 border ${borderColor} shadow-lg overflow-hidden flex-shrink-0 opacity-80`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
        <span className={`text-base font-bold ${resultColor}`}>{getMatchLabel(match)}</span>
        <div className="flex items-center gap-3">
          <span className={`font-bold text-sm ${resultColor}`}>
            {resultLabel}
          </span>
          <div className="flex items-center gap-1.5 text-sm">
            <span className={`font-mono font-bold ${ourAlliance === "red" ? "text-red-400" : "text-red-400/60"}`}>
              {redScore}
            </span>
            <span className="text-slate-600">-</span>
            <span className={`font-mono font-bold ${ourAlliance === "blue" ? "text-blue-400" : "text-blue-400/60"}`}>
              {blueScore}
            </span>
          </div>
        </div>
      </div>

      {/* Alliances */}
      <div className="grid grid-cols-2 divide-x divide-slate-700/50">
        <div className={`px-4 py-3 space-y-1 ${ourAlliance === "red" ? "bg-red-500/5" : ""}`}>
          <div className="text-xs font-bold uppercase tracking-wider text-red-400 mb-1.5">Red Alliance</div>
          {match.alliances.red.team_keys.map(renderTeamRow)}
        </div>
        <div className={`px-4 py-3 space-y-1 ${ourAlliance === "blue" ? "bg-blue-500/5" : ""}`}>
          <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1.5">Blue Alliance</div>
          {match.alliances.blue.team_keys.map(renderTeamRow)}
        </div>
      </div>
    </div>
  );
}

// --- Score Trend Sparkline ---

interface SparklinePoint {
  match: string;
  score: number;
  result: "W" | "L" | "T";
}

function ScoreTrendSparkline({
  matches,
  teamKey,
}: {
  matches: Match[];
  teamKey: string;
}) {
  const data = useMemo(() => {
    const points: SparklinePoint[] = [];
    for (const m of matches) {
      if (m.comp_level !== "qm" || !isMatchCompleted(m)) continue;
      const alliance = getTeamAlliance(m, teamKey);
      if (!alliance) continue;
      const score = m.alliances[alliance].score;
      const result = getMatchResult(m, teamKey) || "T";
      points.push({ match: `Q${m.match_number}`, score, result });
    }
    return points;
  }, [matches, teamKey]);

  if (data.length < 2) return null;

  const resultColors: Record<string, string> = { W: "#4ade80", L: "#f87171", T: "#facc15" };

  return (
    <div className="mx-3 mt-2 flex-shrink-0">
      <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Score Trend</div>
        <div style={{ width: "100%", height: 70 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="score"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#scoreFill)"
                dot={(props: Record<string, unknown>) => {
                  const cx = (props.cx as number) ?? 0;
                  const cy = (props.cy as number) ?? 0;
                  const payload = props.payload as SparklinePoint | undefined;
                  const fill = payload ? (resultColors[payload.result] || "#10b981") : "#10b981";
                  return (
                    <circle
                      key={payload?.match ?? `${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill={fill}
                      stroke="none"
                    />
                  );
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                  padding: "4px 8px",
                }}
                labelStyle={{ color: "#94a3b8" }}
                itemStyle={{ color: "#e2e8f0" }}
                formatter={(value: unknown) => [`${value}`, "Score"]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// --- Pit Notes ---

function PitNoteEditor({
  matchKey,
  initialContent,
  onSaved,
}: {
  matchKey: string;
  initialContent: string;
  onSaved: (matchKey: string, content: string) => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [expanded, setExpanded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  function handleChange(value: string) {
    setContent(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNote(matchKey, value);
      onSaved(matchKey, value);
    }, 800);
  }

  function handleBlur() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveNote(matchKey, content);
    onSaved(matchKey, content);
  }

  const hasContent = content.trim().length > 0;

  return (
    <div className="mx-3 mt-2 flex-shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          hasContent
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-300"
            : "bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-slate-300"
        }`}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        <span className="flex-1 text-left truncate">
          {hasContent ? content.split("\n")[0] : "Pit notes..."}
        </span>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Add pit notes for this match..."
          rows={3}
          className="mt-1 w-full rounded-lg bg-slate-800/80 border border-slate-700/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-emerald-500/50"
        />
      )}
    </div>
  );
}

async function saveNote(matchKey: string, content: string) {
  try {
    await fetch("/api/competition/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchKey, content }),
    });
  } catch {
    // Silent fail
  }
}

// --- Battery Helpers ---

function batteryStatusColor(status: string | null): string {
  if (!status) return "bg-slate-600";
  const colors: Record<string, string> = {
    charging: "bg-green-500",
    in_robot_match: "bg-amber-500",
    in_robot_testing: "bg-blue-500",
    idle: "bg-slate-500",
  };
  return colors[status] || "bg-slate-600";
}

function batteryStatusBadgeClass(status: string | null): string {
  if (!status) return "bg-slate-500/20 text-slate-400";
  const classes: Record<string, string> = {
    charging: "bg-green-500/20 text-green-400",
    in_robot_match: "bg-amber-500/20 text-amber-400",
    in_robot_testing: "bg-blue-500/20 text-blue-400",
    idle: "bg-slate-500/20 text-slate-400",
  };
  return classes[status] || "bg-slate-500/20 text-slate-400";
}

function batteryStatusLabel(status: string | null): string {
  if (!status) return "No status";
  const labels: Record<string, string> = {
    charging: "Charging",
    in_robot_match: "In Robot (Match)",
    in_robot_testing: "In Robot (Testing)",
    idle: "Not in Use",
  };
  return labels[status] || status;
}

function BatteryTimeAgo({ since }: { since: string | null }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!since) {
      setText("");
      return;
    }

    function update() {
      const diff = Math.floor((Date.now() - new Date(since!).getTime()) / 1000);
      if (diff < 60) setText(`${diff}s`);
      else if (diff < 3600) setText(`${Math.floor(diff / 60)}m`);
      else setText(`${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [since]);

  if (!text) return null;
  return <span className="text-xs text-slate-500">{text}</span>;
}

// --- Main Page ---

export default function CompetitionPage() {
  const [data, setData] = useState<CompetitionData | null>(null);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [robotImageError, setRobotImageError] = useState(false);
  const [expandedMatchKey, setExpandedMatchKey] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"pit" | "schedule">("pit");
  const [pitNotes, setPitNotes] = useState<Record<string, string>>({});
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const prevLastMatchKeyRef = useRef<string | null>(null);
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
        setPitNotes(json.pitNotes || {});
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

  // Determine last completed match
  const lastCompletedMatchIndex = useMemo(() => {
    if (!data?.matches) return -1;
    if (nextMatchIndex > 0) return nextMatchIndex - 1;
    if (nextMatchIndex < 0) {
      // All matches completed — last one in the array
      const last = data.matches.length - 1;
      return last >= 0 ? last : -1;
    }
    return -1; // nextMatchIndex === 0, no completed matches yet
  }, [data?.matches, nextMatchIndex]);

  const lastCompletedMatch = useMemo(() => {
    if (!data?.matches || lastCompletedMatchIndex < 0) return null;
    return data.matches[lastCompletedMatchIndex];
  }, [data?.matches, lastCompletedMatchIndex]);

  // Match gap: number of our uncompleted matches between last completed and next
  const matchGap = useMemo(() => {
    if (nextMatchIndex <= 0 || lastCompletedMatchIndex < 0) return 0;
    return nextMatchIndex - lastCompletedMatchIndex - 1;
  }, [nextMatchIndex, lastCompletedMatchIndex]);

  // Bumper color for next match
  const nextMatchAlliance = useMemo(() => {
    if (!nextMatch || !data?.teamKey) return null;
    return getTeamAlliance(nextMatch, data.teamKey);
  }, [nextMatch, data?.teamKey]);

  // Detect new match completion → prompt checklist reset
  useEffect(() => {
    const key = lastCompletedMatch?.key ?? null;
    const prev = prevLastMatchKeyRef.current;
    // Only prompt if a new match completed (not on initial load) and checklist has items checked
    if (prev !== null && key !== null && key !== prev && checkedIds.length > 0) {
      setShowResetPrompt(true);
    }
    prevLastMatchKeyRef.current = key;
  }, [lastCompletedMatch?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine next battery to use (longest on charger)
  const nextBattery = useMemo(() => {
    if (!data?.batteries) return null;
    const charging = data.batteries
      .filter((b) => b.currentStatus === "charging" && b.statusSince)
      .sort((a, b) => new Date(a.statusSince!).getTime() - new Date(b.statusSince!).getTime());
    return charging[0] || null;
  }, [data?.batteries]);

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
    setShowResetPrompt(false);
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
  const teamNames = data.teamNames || {};
  const branding = data.branding;
  const checkedCount = checkedIds.length;
  const totalCount = checklistItems.length;

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden" style={{ zoom: `${zoom}%` }}>
      {/* Header */}
      <div className="bg-slate-800/90 border-b border-slate-700 px-5 py-3 flex items-center justify-between flex-shrink-0 relative">
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
        <div className="absolute left-1/2 -translate-x-1/2 text-xl font-bold tracking-tight text-slate-200 tabular-nums">
          <LiveClock />
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
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

      {/* Bumper color banner */}
      {nextMatchAlliance && (
        <div
          className={`flex-shrink-0 py-2 text-center text-sm font-bold uppercase tracking-widest ${
            nextMatchAlliance === "red"
              ? "bg-red-600 text-white"
              : "bg-blue-600 text-white"
          }`}
        >
          {nextMatchAlliance === "red" ? "RED" : "BLUE"} BUMPERS
        </div>
      )}

      {/* Mobile tab bar */}
      <div className="md:hidden flex-shrink-0 bg-slate-800/70 border-b border-slate-700/50 flex">
        <button
          onClick={() => setMobileTab("pit")}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors ${
            mobileTab === "pit"
              ? "text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Checklist & Batteries
        </button>
        <button
          onClick={() => setMobileTab("schedule")}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors ${
            mobileTab === "schedule"
              ? "text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Match Schedule
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Match Schedule (hidden on mobile unless schedule tab active) */}
        <div className={`flex-[3] flex-col min-h-0 border-r border-slate-700/50 md:flex ${mobileTab === "schedule" ? "flex" : "hidden"}`}>
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
            <div className="flex-1 flex flex-col min-h-0">
              {/* Expanded cards: last result + next match */}
              {lastCompletedMatch && (
                <ExpandedLastMatch match={lastCompletedMatch} teamKey={teamKey} teamNames={teamNames} teamRankings={data.teamRankings || {}} />
              )}
              {nextMatch && (
                <>
                  <ExpandedNextMatch match={nextMatch} teamKey={teamKey} teamNames={teamNames} teamRankings={data.teamRankings || {}} />
                  <PitNoteEditor
                    matchKey={nextMatch.key}
                    initialContent={pitNotes[nextMatch.key] || ""}
                    onSaved={(mk, content) => setPitNotes((prev) => ({ ...prev, [mk]: content }))}
                  />
                </>
              )}

              {/* Score trend sparkline */}
              <ScoreTrendSparkline matches={matches} teamKey={teamKey} />

              {/* Scrollable match list (expanded matches excluded) */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                {matches.map((match, index) => {
                  if (index === nextMatchIndex || index === lastCompletedMatchIndex) return null;

                  const completed = isMatchCompleted(match);
                  const alliance = getTeamAlliance(match, teamKey);
                  const result = getMatchResult(match, teamKey);
                  const redScore = match.alliances.red.score;
                  const blueScore = match.alliances.blue.score;
                  const scheduledTime = match.predicted_time || match.time;
                  const isExpanded = expandedMatchKey === match.key;

                  return (
                    <div key={match.key} className="rounded-lg overflow-hidden">
                      <div
                        onClick={() => setExpandedMatchKey(isExpanded ? null : match.key)}
                        className={`flex items-center gap-2 px-3 py-2.5 transition-all cursor-pointer ${
                          completed
                            ? "bg-slate-800/30 opacity-60 hover:opacity-80"
                            : "bg-slate-800/50 hover:bg-slate-800/70"
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
                          <span className="text-sm font-semibold text-slate-300">
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
                          ) : (
                            <span className="text-xs text-slate-500">
                              {formatMatchTime(scheduledTime)}
                            </span>
                          )}
                        </div>

                        {/* Note indicator */}
                        {pitNotes[match.key] && (
                          <svg className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        )}

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
                        </div>
                      </div>

                      {/* Expanded alliance details */}
                      {isExpanded && (
                        <div className="grid grid-cols-2 divide-x divide-slate-700/50 bg-slate-800/40">
                          <div className={`px-4 py-2.5 space-y-0.5 ${alliance === "red" ? "bg-red-500/5" : ""}`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">Red Alliance</div>
                            {match.alliances.red.team_keys.map((k) => {
                              const isUs = k === teamKey;
                              return (
                                <div key={k} className={`flex items-baseline gap-2 ${isUs ? "text-white font-bold" : "text-slate-300"}`}>
                                  <span className="font-mono text-xs w-10 text-right">{teamNumberFromKey(k)}</span>
                                  <span className={`text-xs truncate ${isUs ? "text-white" : "text-slate-500"}`}>{teamNames[k] || ""}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className={`px-4 py-2.5 space-y-0.5 ${alliance === "blue" ? "bg-blue-500/5" : ""}`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Blue Alliance</div>
                            {match.alliances.blue.team_keys.map((k) => {
                              const isUs = k === teamKey;
                              return (
                                <div key={k} className={`flex items-baseline gap-2 ${isUs ? "text-white font-bold" : "text-slate-300"}`}>
                                  <span className="font-mono text-xs w-10 text-right">{teamNumberFromKey(k)}</span>
                                  <span className={`text-xs truncate ${isUs ? "text-white" : "text-slate-500"}`}>{teamNames[k] || ""}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Checklist + Batteries (hidden on mobile unless pit tab active) */}
        <div className={`flex-[2] flex-col min-h-0 md:flex ${mobileTab === "pit" ? "flex" : "hidden"}`}>
          {/* Pre-Match Checklist */}
          <div className="flex-1 flex flex-col min-h-0">
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

            {/* Auto-reset prompt after match completion */}
            {showResetPrompt && (
              <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2.5 flex-shrink-0">
                <span className="text-sm text-amber-200 flex-1">Match completed — reset checklist?</span>
                <button
                  onClick={handleResetChecklist}
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowResetPrompt(false)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

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

          {/* Battery Panel */}
          {data.batteries && data.batteries.length > 0 && (
            <div className="flex-shrink-0 border-t border-slate-700/50 flex flex-col max-h-[40%]">
              <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Batteries
                </h2>
                {nextBattery && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                    Next: {nextBattery.label}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {data.batteries.map((battery) => {
                  const isNext = nextBattery?.id === battery.id;
                  return (
                    <div
                      key={battery.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                        isNext
                          ? "bg-green-500/10 border border-green-500/30 ring-1 ring-green-500/20"
                          : "bg-slate-800/50 border border-slate-700/30"
                      }`}
                    >
                      {/* Status dot */}
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${batteryStatusColor(battery.currentStatus)}`} />

                      {/* Label */}
                      <span className={`text-sm font-medium flex-shrink-0 ${isNext ? "text-green-300" : "text-slate-200"}`}>
                        {battery.label}
                      </span>

                      {/* Status badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${batteryStatusBadgeClass(battery.currentStatus)}`}>
                        {batteryStatusLabel(battery.currentStatus)}
                      </span>

                      {/* Time in status */}
                      <div className="ml-auto flex-shrink-0">
                        <BatteryTimeAgo since={battery.statusSince} />
                      </div>

                      {/* Next up indicator */}
                      {isNext && (
                        <span className="text-xs font-bold text-green-400 flex-shrink-0">
                          NEXT
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar teamStatus={data.teamStatus} teamKey={teamKey} nextMatch={nextMatch} matchGap={matchGap} />

      {/* Floating controls (bottom-right, hidden on mobile) */}
      <div className="fixed bottom-14 right-4 hidden md:flex items-center gap-1.5 z-50">
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
