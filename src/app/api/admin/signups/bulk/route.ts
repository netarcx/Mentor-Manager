import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { names, shiftIds } = await request.json();

    if (!names || !Array.isArray(names) || names.length === 0) {
      return NextResponse.json(
        { error: "names array is required" },
        { status: 400 }
      );
    }

    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: "shiftIds array is required" },
        { status: 400 }
      );
    }

    // Validate shifts exist and aren't cancelled
    const validShifts = await prisma.shift.findMany({
      where: { id: { in: shiftIds }, cancelled: false },
      select: { id: true },
    });
    const validShiftIds = new Set(validShifts.map((s) => s.id));

    if (validShiftIds.size === 0) {
      return NextResponse.json(
        { error: "No valid shifts found" },
        { status: 404 }
      );
    }

    // Upsert mentors by name (using name as placeholder email for admin-created mentors)
    const mentors = [];
    for (const rawName of names) {
      const name = String(rawName).trim();
      if (!name) continue;

      // Use a generated placeholder email based on the name
      const placeholderEmail = `${name.toLowerCase().replace(/\s+/g, ".")}@placeholder.local`;

      const mentor = await prisma.mentor.upsert({
        where: { email: placeholderEmail },
        update: { name },
        create: { name, email: placeholderEmail },
      });
      mentors.push(mentor);
    }

    if (mentors.length === 0) {
      return NextResponse.json(
        { error: "No valid names provided" },
        { status: 400 }
      );
    }

    // Check which signups already exist
    const existingSignups = await prisma.signup.findMany({
      where: {
        mentorId: { in: mentors.map((m) => m.id) },
        shiftId: { in: [...validShiftIds] },
      },
      select: { mentorId: true, shiftId: true },
    });
    const existingSet = new Set(
      existingSignups.map((s) => `${s.mentorId}-${s.shiftId}`)
    );

    // Build list of new signups only
    const newSignups = mentors.flatMap((mentor) =>
      [...validShiftIds]
        .filter((shiftId) => !existingSet.has(`${mentor.id}-${shiftId}`))
        .map((shiftId) => ({ mentorId: mentor.id, shiftId, note: "" }))
    );

    // Create all new signups in a single transaction
    if (newSignups.length > 0) {
      await prisma.$transaction(
        newSignups.map((data) => prisma.signup.create({ data }))
      );
    }

    return NextResponse.json({
      success: true,
      created: newSignups.length,
      skipped: existingSignups.length,
      mentorCount: mentors.length,
      shiftCount: validShiftIds.size,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
