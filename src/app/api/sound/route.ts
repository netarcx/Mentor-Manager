import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  webm: "audio/webm",
  m4a: "audio/mp4",
};

function getDataDir(): string {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("/app/data/")) {
    return "/app/data";
  }
  return path.resolve(process.cwd(), "data");
}

export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "shift_sound_path" } });

    if (!setting?.value) {
      return new NextResponse(null, { status: 404 });
    }

    const dataDir = getDataDir();
    const filePath = path.join(dataDir, setting.value);

    if (!existsSync(filePath)) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await readFile(filePath);
    const ext = setting.value.split(".").pop()?.toLowerCase() || "mp3";
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
