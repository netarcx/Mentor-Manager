import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

function getDataDir(): string {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("/app/data/")) return "/app/data";
  return path.resolve(process.cwd(), "data");
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const images = await prisma.slideshowImage.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ images });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPEG, GIF, WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const filename = `slideshow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dataDir = getDataDir();

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dataDir, filename), buffer);

    const maxOrder = await prisma.slideshowImage.aggregate({ _max: { sortOrder: true } });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const image = await prisma.slideshowImage.create({
      data: { filename, sortOrder: nextOrder },
    });

    return NextResponse.json(image);
  } catch (error) {
    console.error("Slideshow upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
