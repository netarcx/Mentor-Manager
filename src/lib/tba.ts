import "server-only";
import { cache } from "react";
import { prisma } from "./db";

const TBA_BASE = "https://www.thebluealliance.com/api/v3";

// ── TBA response types ──────────────────────────────────────────────

export interface TBAEvent {
  key: string;
  name: string;
  event_type: number;
  city: string;
  state_prov: string;
  country: string;
  start_date: string;
  end_date: string;
  year: number;
  short_name: string;
  event_type_string: string;
  week: number | null;
}

export interface TBAMatch {
  key: string;
  comp_level: string; // "qm" | "ef" | "qf" | "sf" | "f"
  set_number: number;
  match_number: number;
  alliances: {
    red: { team_keys: string[]; score: number };
    blue: { team_keys: string[]; score: number };
  };
  predicted_time: number | null;
  time: number | null;
  actual_time: number | null;
  post_result_time: number | null;
  winning_alliance: string;
}

export interface TBATeamStatus {
  qual?: {
    ranking?: {
      rank: number;
      record: { wins: number; losses: number; ties: number };
    };
    num_teams?: number;
  };
  alliance?: {
    name: string;
    number: number;
    pick: number;
  };
  playoff?: {
    current_level_record?: { wins: number; losses: number; ties: number };
    status?: string;
  };
  overall_status_str?: string;
}

// ── Competition config (settings KV store) ──────────────────────────

export interface CompetitionConfig {
  enabled: boolean;
  tbaApiKey: string;
  teamKey: string;
  eventKey: string;
  pollInterval: number;
}

const configDefaults: CompetitionConfig = {
  enabled: false,
  tbaApiKey: "",
  teamKey: "",
  eventKey: "",
  pollInterval: 60,
};

const keyMap: Record<string, keyof CompetitionConfig> = {
  competition_enabled: "enabled",
  competition_tba_api_key: "tbaApiKey",
  competition_team_key: "teamKey",
  competition_event_key: "eventKey",
  competition_poll_interval: "pollInterval",
};

async function fetchCompetitionConfig(): Promise<CompetitionConfig> {
  try {
    const keys = Object.keys(keyMap);
    const settings = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });

    const config = { ...configDefaults };
    for (const setting of settings) {
      const field = keyMap[setting.key];
      if (!field || !setting.value) continue;

      if (field === "enabled") {
        config.enabled = setting.value === "true";
      } else if (field === "pollInterval") {
        config.pollInterval = parseInt(setting.value, 10) || 60;
      } else {
        (config as Record<string, unknown>)[field] = setting.value;
      }
    }
    return config;
  } catch {
    return { ...configDefaults };
  }
}

export const getCompetitionConfig = cache(fetchCompetitionConfig);

// ── TBA fetch helpers ───────────────────────────────────────────────

async function tbaFetch<T>(
  path: string,
  apiKey: string
): Promise<T | null> {
  try {
    const res = await fetch(`${TBA_BASE}${path}`, {
      headers: { "X-TBA-Auth-Key": apiKey },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchEvent(
  eventKey: string,
  apiKey: string
): Promise<TBAEvent | null> {
  return tbaFetch<TBAEvent>(`/event/${eventKey}`, apiKey);
}

export async function fetchTeamMatches(
  teamKey: string,
  eventKey: string,
  apiKey: string
): Promise<TBAMatch[]> {
  return (
    (await tbaFetch<TBAMatch[]>(
      `/team/${teamKey}/event/${eventKey}/matches`,
      apiKey
    )) || []
  );
}

export async function fetchTeamStatus(
  teamKey: string,
  eventKey: string,
  apiKey: string
): Promise<TBATeamStatus | null> {
  return tbaFetch<TBATeamStatus>(
    `/team/${teamKey}/event/${eventKey}/status`,
    apiKey
  );
}

// ── Match sorting ───────────────────────────────────────────────────

const COMP_LEVEL_ORDER: Record<string, number> = {
  qm: 0,
  ef: 1,
  qf: 2,
  sf: 3,
  f: 4,
};

export function sortMatches(matches: TBAMatch[]): TBAMatch[] {
  return [...matches].sort((a, b) => {
    const levelA = COMP_LEVEL_ORDER[a.comp_level] ?? 99;
    const levelB = COMP_LEVEL_ORDER[b.comp_level] ?? 99;
    if (levelA !== levelB) return levelA - levelB;
    if (a.set_number !== b.set_number) return a.set_number - b.set_number;
    return a.match_number - b.match_number;
  });
}

export function getMatchLabel(match: TBAMatch): string {
  const labels: Record<string, string> = {
    qm: "Qual",
    ef: "Eighths",
    qf: "Quarters",
    sf: "Semis",
    f: "Final",
  };
  const prefix = labels[match.comp_level] || match.comp_level.toUpperCase();
  if (match.comp_level === "qm") return `${prefix} ${match.match_number}`;
  return `${prefix} ${match.set_number}-${match.match_number}`;
}
