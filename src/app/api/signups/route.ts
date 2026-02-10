import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support batch signups: { mentorId, signups: [{ shiftId, note? }] }
    if (body.signups && Array.isArray(body.signups)) {
      return handleBatchSignup(body);
    }

    // Legacy single signup: { mentorId, shiftId, note? }
    return handleSingleSignup(body);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Already signed up for this shift" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleSingleSignup(body: {
  mentorId?: number;
  shiftId?: number;
  note?: string;
}) {
  const { mentorId, shiftId, note } = body;

  if (!mentorId || !shiftId) {
    return NextResponse.json(
      { error: "mentorId and shiftId are required" },
      { status: 400 }
    );
  }

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.cancelled) {
    return NextResponse.json(
      { error: "Shift not found or cancelled" },
      { status: 404 }
    );
  }

  const signup = await prisma.signup.create({
    data: {
      mentorId,
      shiftId,
      note: note || "",
    },
    include: {
      shift: true,
      mentor: true,
    },
  });

  return NextResponse.json(signup);
}

async function handleBatchSignup(body: {
  mentorId?: number;
  signups?: { shiftId: number; note?: string }[];
}) {
  const { mentorId, signups } = body;

  if (!mentorId || !signups || signups.length === 0) {
    return NextResponse.json(
      { error: "mentorId and signups array are required" },
      { status: 400 }
    );
  }

  const shiftIds = signups.map((s) => s.shiftId);

  // Validate all shifts in one query
  const validShifts = await prisma.shift.findMany({
    where: {
      id: { in: shiftIds },
      cancelled: false,
    },
    select: { id: true },
  });

  const validShiftIds = new Set(validShifts.map((s) => s.id));

  // Filter to only valid shifts
  const validSignups = signups.filter((s) => validShiftIds.has(s.shiftId));

  if (validSignups.length === 0) {
    return NextResponse.json(
      { error: "No valid shifts found" },
      { status: 404 }
    );
  }

  // Filter out shifts the mentor is already signed up for
  const existingSignups = await prisma.signup.findMany({
    where: {
      mentorId,
      shiftId: { in: validSignups.map((s) => s.shiftId) },
    },
    select: { shiftId: true },
  });
  const alreadySignedUp = new Set(existingSignups.map((s) => s.shiftId));
  const newSignups = validSignups.filter((s) => !alreadySignedUp.has(s.shiftId));

  if (newSignups.length === 0) {
    return NextResponse.json(
      { error: "Already signed up for all selected shifts" },
      { status: 409 }
    );
  }

  // Create all signups in a single transaction
  const results = await prisma.$transaction(
    newSignups.map((s) =>
      prisma.signup.create({
        data: {
          mentorId,
          shiftId: s.shiftId,
          note: s.note || "",
        },
      })
    )
  );

  return NextResponse.json({
    created: results.length,
    skipped: alreadySignedUp.size,
    signups: results,
  });
}
