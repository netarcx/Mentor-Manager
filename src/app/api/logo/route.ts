import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
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
    const setting = await prisma.setting.findUnique({ where: { key: "logo_path" } });

    if (!setting?.value) {
      return new NextResponse(null, { status: 404 });
    }

    const dataDir = getDataDir();
    const filePath = path.join(dataDir, setting.value);

    if (!existsSync(filePath)) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await readFile(filePath);
    const ext = setting.value.split(".").pop()?.toLowerCase() || "png";
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }
}
