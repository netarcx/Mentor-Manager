import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [pinRow, captainRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "student_pin" } }),
      prisma.setting.findUnique({ where: { key: "student_captain_pin" } }),
    ]);
    return NextResponse.json({
      pin: pinRow?.value || "",
      captainPin: captainRow?.value || "",
    });
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
    const { pin, captainPin } = await request.json();

    // Blocked PINs: common/guessable sequences
    const BLOCKED_PINS = new Set([
      "0000", "00000", "000000",
      "1111", "11111", "111111",
      "1234", "12345", "123456",
      "2129",
      "2222", "22222", "222222",
      "3333", "33333", "333333",
      "4321", "43210",
      "4444", "44444", "444444",
      "5555", "55555", "555555",
      "6666", "66666", "666666",
      "6789", "67890",
      "7777", "77777", "777777",
      "8888", "88888", "888888",
      "9999", "99999", "999999",
    ]);

    // Validate mentor PIN if provided
    if (pin !== undefined) {
      if (pin !== "" && !/^\d{4,6}$/.test(pin)) {
        return NextResponse.json({ error: "Mentor PIN must be 4-6 digits" }, { status: 400 });
      }
      if (pin !== "" && BLOCKED_PINS.has(pin)) {
        return NextResponse.json({ error: "That PIN is too easy to guess. Choose a less common PIN." }, { status: 400 });
      }
      await prisma.setting.upsert({
        where: { key: "student_pin" },
        update: { value: pin },
        create: { key: "student_pin", value: pin },
      });
    }

    // Validate captain PIN if provided
    if (captainPin !== undefined) {
      if (captainPin !== "" && !/^\d{4,6}$/.test(captainPin)) {
        return NextResponse.json({ error: "Captain PIN must be 4-6 digits" }, { status: 400 });
      }
      if (captainPin !== "" && BLOCKED_PINS.has(captainPin)) {
        return NextResponse.json({ error: "That PIN is too easy to guess. Choose a less common PIN." }, { status: 400 });
      }
      await prisma.setting.upsert({
        where: { key: "student_captain_pin" },
        update: { value: captainPin },
        create: { key: "student_captain_pin", value: captainPin },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
