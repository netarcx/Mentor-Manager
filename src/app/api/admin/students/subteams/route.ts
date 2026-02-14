import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const row = await prisma.setting.findUnique({ where: { key: "student_subteams" } });
    let subteams: string[] = [];
    if (row?.value) {
      try { subteams = JSON.parse(row.value); } catch { /* use default */ }
    }
    return NextResponse.json({ subteams });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { subteams } = await request.json();

    if (!Array.isArray(subteams) || subteams.some((s: unknown) => typeof s !== "string")) {
      return NextResponse.json({ error: "subteams must be an array of strings" }, { status: 400 });
    }

    const cleaned = subteams.map((s: string) => s.trim()).filter(Boolean);

    await prisma.setting.upsert({
      where: { key: "student_subteams" },
      update: { value: JSON.stringify(cleaned) },
      create: { key: "student_subteams", value: JSON.stringify(cleaned) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
