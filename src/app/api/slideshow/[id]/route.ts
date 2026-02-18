import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function getDataDir(): string {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("/app/data/")) return "/app/data";
  return path.resolve(process.cwd(), "data");
}

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const imageId = parseInt(id, 10);
  if (isNaN(imageId)) return new NextResponse(null, { status: 400 });

  try {
    const image = await prisma.slideshowImage.findUnique({ where: { id: imageId } });
    if (!image) return new NextResponse(null, { status: 404 });

    const filePath = path.join(getDataDir(), image.filename);
    if (!existsSync(filePath)) return new NextResponse(null, { status: 404 });

    const buffer = await readFile(filePath);
    const ext = image.filename.split(".").pop()?.toLowerCase() || "png";
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
