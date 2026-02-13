import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { previewReminders } from "@/lib/notifications";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preview = await previewReminders();
    return NextResponse.json(preview);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
