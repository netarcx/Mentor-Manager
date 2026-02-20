import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayISO();
    const goal = await prisma.dailyGoal.findUnique({ where: { date: today } });
    return NextResponse.json({ date: today, text: goal?.text || "" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { text } = await request.json();
    const today = todayISO();
    const cleaned = (text || "").replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "");

    const goal = await prisma.dailyGoal.upsert({
      where: { date: today },
      update: { text: cleaned },
      create: { date: today, text: cleaned },
    });

    return NextResponse.json({ date: goal.date, text: goal.text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
