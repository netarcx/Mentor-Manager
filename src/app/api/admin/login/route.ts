import { NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/db";
import { createAdminSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const setting = await prisma.setting.findUnique({
      where: { key: "admin_password" },
    });

    if (!setting) {
      return NextResponse.json(
        { error: "Admin password not configured" },
        { status: 500 }
      );
    }

    const valid = await bcryptjs.compare(password, setting.value);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    await createAdminSession();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
