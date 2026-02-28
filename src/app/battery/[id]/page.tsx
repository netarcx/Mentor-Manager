"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";

interface BatteryLog {
  id: number;
  status: string;
  matchKey: string;
  note: string;
  voltage: number | null;
  createdAt: string;
}

interface BatteryData {
  id: number;
  label: string;
  active: boolean;
  retired: boolean;
  cycleCount: number;
  currentStatus: string | null;
  statusSince: string | null;
  matchKey: string;
  recentLogs: BatteryLog[];
}

interface NextMatchInfo {
  label: string;
  key: string;
}

const STATUS_OPTIONS = [
  { value: "charging", label: "On Charger", color: "bg-green-600 hover:bg-green-500", icon: "\u26A1" },
  { value: "in_robot_match", label: "In Robot \u2014 Match", color: "bg-amber-600 hover:bg-amber-500", icon: "\uD83E\uDD16" },
  { value: "in_robot_testing", label: "In Robot \u2014 Testing", color: "bg-blue-600 hover:bg-blue-500", icon: "\uD83D\uDD27" },
  { value: "idle", label: "Not in Use", color: "bg-slate-600 hover:bg-slate-500", icon: "\u23F8\uFE0F" },
] as const;

function statusLabel(status: string | null): string {
  if (!status) return "No status";
  const labels: Record<string, string> = {
    charging: "On Charger",
    in_robot_match: "In Robot (Match)",
    in_robot_testing: "In Robot (Testing)",
    idle: "Not in Use",
  };
  return labels[status] || status;
}

function statusColor(status: string | null): string {
  if (!status) return "bg-slate-700 text-slate-300";
  const colors: Record<string, string> = {
    charging: "bg-green-500/20 text-green-400",
    in_robot_match: "bg-amber-500/20 text-amber-400",
    in_robot_testing: "bg-blue-500/20 text-blue-400",
    idle: "bg-slate-500/20 text-slate-400",
  };
  return colors[status] || "bg-slate-700 text-slate-300";
}

function TimeAgo({ since }: { since: string | null }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!since) {
      setText("");
      return;
    }

    function update() {
      const diff = Math.floor((Date.now() - new Date(since!).getTime()) / 1000);
      if (diff < 60) setText(`${diff}s ago`);
      else if (diff < 3600) setText(`${Math.floor(diff / 60)}m ago`);
      else setText(`${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [since]);

  return <span>{text}</span>;
}

function LogTimeDisplay({ createdAt }: { createdAt: string }) {
  const d = new Date(createdAt);
  return (
    <span>
      {d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
      })}
    </span>
  );
}

export default function BatteryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<BatteryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextMatch, setNextMatch] = useState<NextMatchInfo | null>(null);

  // Extras panel state
  const [extrasLogId, setExtrasLogId] = useState<number | null>(null);
  const [extrasVoltage, setExtrasVoltage] = useState("");
  const [extrasNote, setExtrasNote] = useState("");
  const [extrasSaving, setExtrasSaving] = useState(false);
  const extrasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBattery = useCallback(async () => {
    try {
      const res = await fetch(`/api/battery/${id}`);
      if (!res.ok) {
        setError("Battery not found");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load battery");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch next match info for auto-filling match key
  useEffect(() => {
    fetch("/api/competition")
      .then((r) => r.json())
      .then((json) => {
        if (!json.enabled || !json.matches) return;
        const next = json.matches.find(
          (m: { actual_time: number | null; winning_alliance: string | null }) =>
            m.actual_time === null || m.winning_alliance === null
        );
        if (next) {
          const level = next.comp_level;
          let label = `Qual ${next.match_number}`;
          if (level !== "qm") {
            const labels: Record<string, string> = { ef: "Eighths", qf: "Quarters", sf: "Semis", f: "Final" };
            label = `${labels[level] || level.toUpperCase()} ${next.set_number}-${next.match_number}`;
          }
          setNextMatch({ label, key: next.key });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBattery();
  }, [fetchBattery]);

  // Hide nav
  useEffect(() => {
    const nav = document.getElementById("main-nav");
    if (nav) nav.style.display = "none";
    return () => {
      const nav = document.getElementById("main-nav");
      if (nav) nav.style.display = "";
    };
  }, []);

  // Auto-dismiss extras panel
  useEffect(() => {
    return () => {
      if (extrasTimerRef.current) clearTimeout(extrasTimerRef.current);
    };
  }, []);

  function dismissExtras() {
    if (extrasTimerRef.current) clearTimeout(extrasTimerRef.current);
    setExtrasLogId(null);
    setExtrasVoltage("");
    setExtrasNote("");
  }

  async function handleStatusChange(status: string) {
    if (submitting) return;
    setSubmitting(true);
    dismissExtras();

    const body: { status: string; matchKey?: string } = { status };
    if (status === "in_robot_match" && nextMatch) {
      body.matchKey = nextMatch.key;
    }

    try {
      const res = await fetch(`/api/battery/${id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const log = await res.json();
      setFlash(statusLabel(status));
      setTimeout(() => setFlash(null), 2000);
      await fetchBattery();

      // Show extras panel
      if (log.id) {
        setExtrasLogId(log.id);
        setExtrasVoltage("");
        setExtrasNote("");
        extrasTimerRef.current = setTimeout(dismissExtras, 8000);
      }
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExtrasSave() {
    if (!extrasLogId) return;
    setExtrasSaving(true);
    if (extrasTimerRef.current) clearTimeout(extrasTimerRef.current);

    const body: { voltage?: number; note?: string } = {};
    const v = parseFloat(extrasVoltage);
    if (extrasVoltage && !isNaN(v)) body.voltage = v;
    if (extrasNote.trim()) body.note = extrasNote.trim();

    if (Object.keys(body).length > 0) {
      await fetch(`/api/battery/${id}/log/${extrasLogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await fetchBattery();
    }

    setExtrasSaving(false);
    dismissExtras();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl font-semibold mb-2">
            {error || "Battery not found"}
          </div>
          <p className="text-slate-500">Check the QR code and try again.</p>
        </div>
      </div>
    );
  }

  const isRetired = data.retired;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Flash notification */}
      {flash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-semibold animate-pulse">
          Updated: {flash}
        </div>
      )}

      {/* Retired banner */}
      {isRetired && (
        <div className="bg-red-600/90 text-white px-5 py-3 text-center font-semibold text-sm">
          This battery is retired and can no longer be used.
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{data.label}</h1>
          {data.cycleCount > 0 && (
            <span className="text-sm text-slate-400">{data.cycleCount} match{data.cycleCount !== 1 ? "es" : ""}</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${statusColor(data.currentStatus)}`}>
            {statusLabel(data.currentStatus)}
          </span>
          {data.statusSince && (
            <span className="text-slate-400 text-sm">
              <TimeAgo since={data.statusSince} />
            </span>
          )}
        </div>
        {data.currentStatus === "in_robot_match" && data.matchKey && (
          <div className="mt-1 text-sm text-slate-400">
            Match: {data.matchKey}
          </div>
        )}
      </div>

      {/* Status buttons */}
      <div className="px-5 py-4 grid grid-cols-1 gap-3">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusChange(opt.value)}
            disabled={submitting || data.currentStatus === opt.value || isRetired}
            className={`w-full py-4 rounded-xl text-lg font-semibold transition-all flex items-center justify-center gap-3 ${opt.color} ${
              data.currentStatus === opt.value
                ? "ring-2 ring-white/40 opacity-60"
                : ""
            } disabled:opacity-40`}
          >
            <span className="text-2xl">{opt.icon}</span>
            {opt.label}
            {opt.value === "in_robot_match" && nextMatch && (
              <span className="text-sm opacity-75 font-normal">
                ({nextMatch.label})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Post-tap extras panel */}
      {extrasLogId && (
        <div className="px-5 pb-4 animate-[slideDown_0.2s_ease-out]">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
            <p className="text-sm text-slate-400 font-medium">Add details (optional)</p>
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={extrasVoltage}
                onChange={(e) => setExtrasVoltage(e.target.value)}
                placeholder="12.8"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
              />
              <span className="self-center text-sm text-slate-400">V</span>
            </div>
            <input
              type="text"
              value={extrasNote}
              onChange={(e) => setExtrasNote(e.target.value)}
              placeholder="Note (e.g. swollen, weak)"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
            />
            <div className="flex gap-3">
              <button
                onClick={handleExtrasSave}
                disabled={extrasSaving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {extrasSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={dismissExtras}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent history */}
      {data.recentLogs.length > 0 && (
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Recent History
          </h2>
          <div className="space-y-2">
            {data.recentLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-800/60 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${statusColor(log.status)}`}>
                      {statusLabel(log.status)}
                    </span>
                    {log.matchKey && (
                      <span className="text-xs text-slate-500">{log.matchKey}</span>
                    )}
                    {log.voltage !== null && (
                      <span className="text-xs font-mono text-yellow-400">{log.voltage.toFixed(1)}V</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    <LogTimeDisplay createdAt={log.createdAt} />
                  </span>
                </div>
                {log.note && (
                  <p className="text-xs text-slate-500 italic mt-1 truncate">{log.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
