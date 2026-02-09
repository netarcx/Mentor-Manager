import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const mentor = await prisma.mentor.upsert({
      where: { email: email.toLowerCase().trim() },
      update: { name: name.trim() },
      create: { name: name.trim(), email: email.toLowerCase().trim() },
    });

    return NextResponse.json(mentor);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
