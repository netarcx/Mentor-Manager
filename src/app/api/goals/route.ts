import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const today = todayISO();
    const goal = await prisma.dailyGoal.findUnique({ where: { date: today } });
    return NextResponse.json({ date: today, text: goal?.text || "" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { text } = await request.json();
    const today = todayISO();

    const goal = await prisma.dailyGoal.upsert({
      where: { date: today },
      update: { text: text || "" },
      create: { date: today, text: text || "" },
    });

    return NextResponse.json({ date: goal.date, text: goal.text });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
