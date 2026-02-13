import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { generateShiftsFromTemplates } from "@/lib/shifts";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const weeksAhead = body.weeksAhead || 4;

    const generated = await generateShiftsFromTemplates(weeksAhead);

    return NextResponse.json({ generated });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
