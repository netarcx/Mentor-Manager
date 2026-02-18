import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { shiftDurationHours, todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ATTENDANCE_START = "2026-02-12";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get("seasonId");
  const daysParam = searchParams.get("days");
  const today = todayISO();

  // Determine date range — capped at today (no future data)
  let startDate = ATTENDANCE_START;
  let endDate = today;

  if (seasonId) {
    const season = await prisma.season.findUnique({ where: { id: parseInt(seasonId, 10) } });
    if (season) {
      startDate = season.startDate;
      endDate = season.endDate < today ? season.endDate : today;
    }
  }

  if (daysParam) {
    const days = parseInt(daysParam, 10);
    if (days > 0) {
      const d = new Date();
      d.setDate(d.getDate() - days);
      const cutoff = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (cutoff > startDate) startDate = cutoff;
    }
  }

  try {
    // Mentor data: shifts with signups in range
    const shifts = await prisma.shift.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        cancelled: false,
      },
      include: {
        signups: {
          include: { mentor: { select: { id: true, name: true } } },
        },
      },
    });

    // Student attendance in range
    const studentAttendance = await prisma.studentAttendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      include: {
        student: { select: { id: true, name: true } },
      },
    });

    // --- Overview ---
    const mentorIdSet = new Set<number>();
    let totalMentorHours = 0;
    for (const shift of shifts) {
      for (const signup of shift.signups) {
        mentorIdSet.add(signup.mentor.id);
        const sStart = signup.customStartTime || shift.startTime;
        const sEnd = signup.customEndTime || shift.endTime;
        totalMentorHours += shiftDurationHours(sStart, sEnd);
      }
    }

    const studentIdSet = new Set<number>();
    let totalStudentMinutes = 0;
    for (const att of studentAttendance) {
      studentIdSet.add(att.student.id);
      if (att.checkedOutAt) {
        const ms = new Date(att.checkedOutAt).getTime() - new Date(att.checkedInAt).getTime();
        totalStudentMinutes += Math.max(0, ms / 60000);
      }
    }

    const overview = {
      totalMentorHours: Math.round(totalMentorHours * 10) / 10,
      totalStudentHours: Math.round((totalStudentMinutes / 60) * 10) / 10,
      activeMentors: mentorIdSet.size,
      activeStudents: studentIdSet.size,
    };

    // --- Daily Attendance ---
    const dailyMap = new Map<string, { mentors: Set<number>; students: Set<number> }>();
    for (const shift of shifts) {
      if (!dailyMap.has(shift.date)) {
        dailyMap.set(shift.date, { mentors: new Set(), students: new Set() });
      }
      for (const signup of shift.signups) {
        dailyMap.get(shift.date)!.mentors.add(signup.mentor.id);
      }
    }
    for (const att of studentAttendance) {
      if (!dailyMap.has(att.date)) {
        dailyMap.set(att.date, { mentors: new Set(), students: new Set() });
      }
      dailyMap.get(att.date)!.students.add(att.student.id);
    }
    const dailyAttendance = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        mentors: data.mentors.size,
        students: data.students.size,
      }));

    // --- Day of Week ---
    const dayOfWeekData = Array.from({ length: 7 }, (_, i) => ({
      day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
      mentors: 0,
      students: 0,
      count: 0,
    }));
    for (const entry of dailyAttendance) {
      const [y, m, d] = entry.date.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      dayOfWeekData[dow].mentors += entry.mentors;
      dayOfWeekData[dow].students += entry.students;
      dayOfWeekData[dow].count += 1;
    }
    const dayOfWeek = dayOfWeekData.map((d) => ({
      day: d.day,
      mentors: d.count > 0 ? Math.round((d.mentors / d.count) * 10) / 10 : 0,
      students: d.count > 0 ? Math.round((d.students / d.count) * 10) / 10 : 0,
    }));

    // --- Subteam Breakdown ---
    const subteamMap = new Map<string, number>();
    for (const att of studentAttendance) {
      const team = att.subteam || "Unassigned";
      subteamMap.set(team, (subteamMap.get(team) || 0) + 1);
    }
    const subteamBreakdown = Array.from(subteamMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // --- Top Mentors ---
    const mentorHoursMap = new Map<number, { name: string; hours: number; shifts: number }>();
    for (const shift of shifts) {
      for (const signup of shift.signups) {
        const existing = mentorHoursMap.get(signup.mentor.id) || {
          name: signup.mentor.name,
          hours: 0,
          shifts: 0,
        };
        const sStart = signup.customStartTime || shift.startTime;
        const sEnd = signup.customEndTime || shift.endTime;
        existing.hours += shiftDurationHours(sStart, sEnd);
        existing.shifts += 1;
        mentorHoursMap.set(signup.mentor.id, existing);
      }
    }
    const topMentors = Array.from(mentorHoursMap.values())
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10)
      .map((m) => ({ ...m, hours: Math.round(m.hours * 10) / 10 }));

    // --- Top Students ---
    const studentHoursMap = new Map<number, { name: string; hours: number; checkIns: number }>();
    for (const att of studentAttendance) {
      const existing = studentHoursMap.get(att.student.id) || {
        name: att.student.name,
        hours: 0,
        checkIns: 0,
      };
      existing.checkIns += 1;
      if (att.checkedOutAt) {
        const ms = new Date(att.checkedOutAt).getTime() - new Date(att.checkedInAt).getTime();
        existing.hours += Math.max(0, ms / 3600000);
      }
      studentHoursMap.set(att.student.id, existing);
    }
    const topStudents = Array.from(studentHoursMap.values())
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10)
      .map((s) => ({ ...s, hours: Math.round(s.hours * 10) / 10 }));

    return NextResponse.json({
      overview,
      dailyAttendance,
      dayOfWeek,
      subteamBreakdown,
      topMentors,
      topStudents,
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
