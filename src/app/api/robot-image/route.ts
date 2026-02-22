import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  getCompetitionConfig,
  fetchTeamMedia,
  getBestRobotImageUrl,
} from "@/lib/tba";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
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
    const [sourceSetting, pathSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "competition_robot_image_source" } }),
      prisma.setting.findUnique({ where: { key: "competition_robot_image_path" } }),
    ]);

    const source = sourceSetting?.value || "none";

    if (source === "none") {
      return new NextResponse(null, { status: 404 });
    }

    // Serve uploaded file
    if (source === "upload") {
      if (!pathSetting?.value) {
        return new NextResponse(null, { status: 404 });
      }

      const dataDir = getDataDir();
      const filePath = path.join(dataDir, pathSetting.value);

      if (!existsSync(filePath)) {
        return new NextResponse(null, { status: 404 });
      }

      const buffer = await readFile(filePath);
      const ext = pathSetting.value.split(".").pop()?.toLowerCase() || "png";
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Proxy TBA image
    if (source === "tba") {
      const config = await getCompetitionConfig();
      if (!config.tbaApiKey || !config.teamKey) {
        return new NextResponse(null, { status: 404 });
      }

      const year = new Date().getFullYear();
      const media = await fetchTeamMedia(config.teamKey, year, config.tbaApiKey);
      const imageUrl = getBestRobotImageUrl(media);

      if (!imageUrl) {
        return new NextResponse(null, { status: 404 });
      }

      // Proxy the image to avoid CORS issues
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        return new NextResponse(null, { status: 404 });
      }

      const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
      const ct = imageRes.headers.get("content-type") || "image/jpeg";

      return new NextResponse(imageBuffer, {
        headers: {
          "Content-Type": ct,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return new NextResponse(null, { status: 404 });
  } catch (error) {
    console.error("Robot image error:", error);
    return new NextResponse(null, { status: 500 });
  }
}
