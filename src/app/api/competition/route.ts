import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getCompetitionConfig,
  fetchEvent,
  fetchTeamMatches,
  fetchTeamStatus,
  fetchEventTeams,
  fetchEventRankings,
  sortMatches,
} from "@/lib/tba";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getCompetitionConfig();

    if (!config.enabled || !config.tbaApiKey || !config.teamKey || !config.eventKey) {
      return NextResponse.json({ enabled: false });
    }

    const [event, matches, teamStatus, eventTeams, rankings, checklistItems, checklistState, branding, robotImageSetting, batteries, pitNoteSettings] =
      await Promise.all([
        fetchEvent(config.eventKey, config.tbaApiKey),
        fetchTeamMatches(config.teamKey, config.eventKey, config.tbaApiKey),
        fetchTeamStatus(config.teamKey, config.eventKey, config.tbaApiKey),
        fetchEventTeams(config.eventKey, config.tbaApiKey),
        fetchEventRankings(config.eventKey, config.tbaApiKey),
        prisma.checklistItem.findMany({
          where: { active: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.setting.findUnique({ where: { key: "competition_checklist_state" } }),
        getBranding(),
        prisma.setting.findUnique({ where: { key: "competition_robot_image_source" } }),
        prisma.battery.findMany({
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: { logs: { take: 1, orderBy: { createdAt: "desc" } } },
        }),
        prisma.setting.findMany({
          where: { key: { startsWith: "pit_note_" } },
        }),
      ]);

    const teamNames: Record<string, string> = {};
    for (const team of eventTeams) {
      teamNames[team.key] = team.nickname;
    }

    const teamRankings: Record<string, { rank: number; record: { wins: number; losses: number; ties: number } }> = {};
    for (const r of rankings) {
      teamRankings[r.team_key] = { rank: r.rank, record: r.record };
    }

    const pitNotes: Record<string, string> = {};
    for (const s of pitNoteSettings) {
      const matchKey = s.key.replace("pit_note_", "");
      if (s.value) pitNotes[matchKey] = s.value;
    }

    let checkedIds: number[] = [];
    if (checklistState?.value) {
      try {
        checkedIds = JSON.parse(checklistState.value);
      } catch {
        checkedIds = [];
      }
    }

    const eventTeamList = eventTeams
      .map((t) => ({
        number: t.team_number,
        name: t.nickname,
        city: t.city,
        stateProv: t.state_prov,
        country: t.country,
      }))
      .sort((a, b) => a.number - b.number);

    return NextResponse.json({
      enabled: true,
      event: event
        ? {
            name: event.name,
            shortName: event.short_name,
            city: event.city,
            stateProv: event.state_prov,
            country: event.country,
            startDate: event.start_date,
            endDate: event.end_date,
            year: event.year,
            eventTypeString: event.event_type_string,
            week: event.week,
          }
        : null,
      matches: sortMatches(matches),
      teamStatus,
      eventTeams: eventTeamList,
      checklist: {
        items: checklistItems.map((item) => ({
          id: item.id,
          text: item.text,
          sortOrder: item.sortOrder,
        })),
        checkedIds,
      },
      branding: {
        appName: branding.appName,
        logoPath: branding.logoPath,
      },
      teamNames,
      teamRankings,
      pitNotes,
      teamKey: config.teamKey,
      pollInterval: config.pollInterval,
      robotImageSource: robotImageSetting?.value || "none",
      batteries: batteries.map((b) => ({
        id: b.id,
        label: b.label,
        currentStatus: b.logs[0]?.status || null,
        statusSince: b.logs[0]?.createdAt || null,
        matchKey: b.logs[0]?.matchKey || "",
      })),
    });
  } catch (error) {
    console.error("Competition API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
