import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Generate iCal format timestamp in local time (no timezone conversion)
function toICalDateLocal(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  // Format: YYYYMMDDTHHmmss (no Z suffix - indicates local time per TZID)
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}00`;
}

// Generate unique UID for each event
function generateUID(shiftId: number, mentorId: number): string {
  return `shift-${shiftId}-mentor-${mentorId}@mentor-manager`;
}

// Escape special characters in iCal text fields
function escapeICalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Find mentor by email
    const mentor = await prisma.mentor.findUnique({
      where: { email },
      include: {
        signups: {
          include: {
            shift: true,
          },
          orderBy: {
            shift: {
              date: "asc",
            },
          },
        },
      },
    });

    if (!mentor) {
      return NextResponse.json(
        { error: "Mentor not found" },
        { status: 404 }
      );
    }

    // Filter out cancelled shifts and past shifts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const activeSignups = mentor.signups.filter(
      (signup) => !signup.shift.cancelled && signup.shift.date >= todayStr
    );

    // Generate iCal content
    const events = activeSignups.map((signup) => {
      const shift = signup.shift;
      const dtstart = toICalDateLocal(shift.date, shift.startTime);
      const dtend = toICalDateLocal(shift.date, shift.endTime);
      const uid = generateUID(shift.id, mentor.id);
      const summary = shift.label || "Mentor Shift";
      const description = signup.note
        ? escapeICalText(`Note: ${signup.note}`)
        : "Mentor shift";

      return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${toICalDateLocal(shift.date, shift.startTime)}
DTSTART;TZID=America/Chicago:${dtstart}
DTEND;TZID=America/Chicago:${dtend}
SUMMARY:${escapeICalText(summary)}
DESCRIPTION:${description}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT`;
    });

    const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mentor Manager//Shift Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeICalText(mentor.name)} - Mentor Shifts
X-WR-TIMEZONE:America/Chicago
X-WR-CALDESC:Your scheduled mentor shifts
BEGIN:VTIMEZONE
TZID:America/Chicago
BEGIN:DAYLIGHT
TZOFFSETFROM:-0600
TZOFFSETTO:-0500
TZNAME:CDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0500
TZOFFSETTO:-0600
TZNAME:CST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
${events.join("\n")}
END:VCALENDAR`;

    return new NextResponse(icalContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${mentor.name.replace(/\s+/g, "-")}-shifts.ics"`,
      },
    });
  } catch (error) {
    console.error("Calendar export error:", error);
    return NextResponse.json(
      { error: "Failed to generate calendar" },
      { status: 500 }
    );
  }
}
