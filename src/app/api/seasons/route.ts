import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const seasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json({ seasons });
}
