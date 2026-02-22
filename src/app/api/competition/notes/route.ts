import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const matchKey = request.nextUrl.searchParams.get("matchKey");
    if (!matchKey) {
      return NextResponse.json({ error: "matchKey required" }, { status: 400 });
    }

    const setting = await prisma.setting.findUnique({
      where: { key: `pit_note_${matchKey}` },
    });

    return NextResponse.json({ content: setting?.value || "" });
  } catch (error) {
    console.error("Pit notes GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { matchKey, content } = await request.json();

    if (!matchKey || typeof matchKey !== "string") {
      return NextResponse.json({ error: "matchKey required" }, { status: 400 });
    }

    const key = `pit_note_${matchKey}`;

    if (!content || content.trim() === "") {
      await prisma.setting.deleteMany({ where: { key } });
    } else {
      await prisma.setting.upsert({
        where: { key },
        update: { value: content },
        create: { key, value: content },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pit notes PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
