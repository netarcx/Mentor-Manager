import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getCompetitionConfig,
  fetchEvent,
  fetchTeamMatches,
  fetchTeamStatus,
  fetchEventTeams,
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

    const [event, matches, teamStatus, eventTeams, checklistItems, checklistState, branding, robotImageSetting] =
      await Promise.all([
        fetchEvent(config.eventKey, config.tbaApiKey),
        fetchTeamMatches(config.teamKey, config.eventKey, config.tbaApiKey),
        fetchTeamStatus(config.teamKey, config.eventKey, config.tbaApiKey),
        fetchEventTeams(config.eventKey, config.tbaApiKey),
        prisma.checklistItem.findMany({
          where: { active: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.setting.findUnique({ where: { key: "competition_checklist_state" } }),
        getBranding(),
        prisma.setting.findUnique({ where: { key: "competition_robot_image_source" } }),
      ]);

    const teamNames: Record<string, string> = {};
    for (const team of eventTeams) {
      teamNames[team.key] = team.nickname;
    }

    let checkedIds: number[] = [];
    if (checklistState?.value) {
      try {
        checkedIds = JSON.parse(checklistState.value);
      } catch {
        checkedIds = [];
      }
    }

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
      teamKey: config.teamKey,
      pollInterval: config.pollInterval,
      robotImageSource: robotImageSetting?.value || "none",
    });
  } catch (error) {
    console.error("Competition API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
