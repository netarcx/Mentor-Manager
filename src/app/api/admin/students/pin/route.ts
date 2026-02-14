import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const row = await prisma.setting.findUnique({ where: { key: "student_pin" } });
    return NextResponse.json({ pin: row?.value || "" });
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
    const { pin } = await request.json();

    // Allow empty string to remove PIN
    if (pin !== "" && (!/^\d{4,6}$/.test(pin))) {
      return NextResponse.json({ error: "PIN must be 4-6 digits" }, { status: 400 });
    }

    await prisma.setting.upsert({
      where: { key: "student_pin" },
      update: { value: pin },
      create: { key: "student_pin", value: pin },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
