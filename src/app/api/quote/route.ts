import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const random = searchParams.get("random") === "true";

    const count = await prisma.quote.count({ where: { active: true } });

    if (count === 0) {
      return NextResponse.json({ quote: null });
    }

    let index: number;
    if (random) {
      index = Math.floor(Math.random() * count);
    } else {
      const now = new Date();
      const hourSeed = now.getFullYear() * 1000000 + (now.getMonth() + 1) * 10000 + now.getDate() * 100 + now.getHours();
      index = hourSeed % count;
    }

    const quotes = await prisma.quote.findMany({
      where: { active: true },
      select: { id: true, text: true, author: true },
      skip: index,
      take: 1,
    });

    return NextResponse.json({ quote: quotes[0] || null });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
