import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { isValidHexColor } from "@/lib/branding";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      appName,
      appTitle,
      colorPrimary,
      colorPrimaryDark,
      colorPrimaryLight,
      colorNavy,
      colorNavyDark,
      colorAccentBg,
    } = body;

    const updates: { key: string; value: string }[] = [];

    if (appName !== undefined) {
      updates.push({ key: "app_name", value: String(appName).slice(0, 100) });
    }
    if (appTitle !== undefined) {
      updates.push({ key: "app_title", value: String(appTitle).slice(0, 100) });
    }

    const colorFields: { value: unknown; key: string; label: string }[] = [
      { value: colorPrimary, key: "color_primary", label: "primary color" },
      { value: colorPrimaryDark, key: "color_primary_dark", label: "primary dark color" },
      { value: colorPrimaryLight, key: "color_primary_light", label: "primary light color" },
      { value: colorNavy, key: "color_navy", label: "navy color" },
      { value: colorNavyDark, key: "color_navy_dark", label: "navy dark color" },
      { value: colorAccentBg, key: "color_accent_bg", label: "accent background color" },
    ];

    for (const field of colorFields) {
      if (field.value !== undefined) {
        if (!isValidHexColor(field.value as string)) {
          return NextResponse.json(
            { error: `Invalid ${field.label} format` },
            { status: 400 }
          );
        }
        updates.push({ key: field.key, value: field.value as string });
      }
    }

    for (const { key, value } of updates) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.json({ success: true, updated: updates.length });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
