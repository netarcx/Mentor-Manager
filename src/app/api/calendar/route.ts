import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Generate iCal format timestamp
function toICalDate(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);

  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
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
      const dtstart = toICalDate(shift.date, shift.startTime);
      const dtend = toICalDate(shift.date, shift.endTime);
      const uid = generateUID(shift.id, mentor.id);
      const summary = shift.label || "Mentor Shift";
      const description = signup.note
        ? escapeICalText(`Note: ${signup.note}`)
        : "Mentor shift";

      return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${toICalDate(shift.date, shift.startTime)}
DTSTART:${dtstart}
DTEND:${dtend}
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
X-WR-TIMEZONE:America/New_York
X-WR-CALDESC:Your scheduled mentor shifts
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
