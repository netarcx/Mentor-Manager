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

    // Create all signup combinations, skipping duplicates
    let created = 0;
    let skipped = 0;

    for (const mentor of mentors) {
      for (const shiftId of validShiftIds) {
        try {
          await prisma.signup.create({
            data: {
              mentorId: mentor.id,
              shiftId,
              note: "",
            },
          });
          created++;
        } catch (error: unknown) {
          // Skip duplicate signups (unique constraint violation)
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "P2002"
          ) {
            skipped++;
          } else {
            throw error;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      mentorCount: mentors.length,
      shiftCount: validShiftIds.size,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
