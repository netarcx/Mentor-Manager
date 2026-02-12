import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

function getDataDir(): string {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("/app/data/")) {
    return "/app/data";
  }
  return path.resolve(process.cwd(), "data");
}

const ALLOWED_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/x-wav"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("sound") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: MP3, WAV, OGG, WebM" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const filename = `shift-sound.${ext}`;
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, filename);

    // Remove old sound if exists
    const oldSetting = await prisma.setting.findUnique({ where: { key: "shift_sound_path" } });
    if (oldSetting?.value) {
      const oldPath = path.join(dataDir, oldSetting.value);
      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    }

    // Save new sound
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Store just the filename in settings
    await prisma.setting.upsert({
      where: { key: "shift_sound_path" },
      update: { value: filename },
      create: { key: "shift_sound_path", value: filename },
    });

    return NextResponse.json({ success: true, soundPath: filename });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.setting.findUnique({ where: { key: "shift_sound_path" } });
    if (setting?.value) {
      const dataDir = getDataDir();
      const filePath = path.join(dataDir, setting.value);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    }

    await prisma.setting.upsert({
      where: { key: "shift_sound_path" },
      update: { value: "" },
      create: { key: "shift_sound_path", value: "" },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
