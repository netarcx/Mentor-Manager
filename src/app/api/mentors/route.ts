import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");

    // If email is provided, return that specific mentor with signups
    if (email) {
      const mentor = await prisma.mentor.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
          signups: {
            include: {
              shift: { select: { id: true, date: true, startTime: true, endTime: true, label: true, cancelled: true } },
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

      return NextResponse.json(mentor);
    }

    // Otherwise, return all mentors (list view)
    const mentors = await prisma.mentor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({ mentors });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if registration is closed for new mentors
    const existing = await prisma.mentor.findUnique({ where: { email: normalizedEmail } });
    if (!existing) {
      const regSetting = await prisma.setting.findUnique({ where: { key: "registration_enabled" } });
      if (regSetting && regSetting.value === "false") {
        return NextResponse.json(
          { error: "New mentor registration is currently closed" },
          { status: 403 }
        );
      }
    }

    const mentor = await prisma.mentor.upsert({
      where: { email: normalizedEmail },
      update: { name: name.trim() },
      create: { name: name.trim(), email: normalizedEmail },
    });

    return NextResponse.json(mentor);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
