import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

function getDataDir(): string {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("/app/data/")) return "/app/data";
  return path.resolve(process.cwd(), "data");
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const imageId = parseInt(id, 10);
  if (isNaN(imageId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const image = await prisma.slideshowImage.findUnique({ where: { id: imageId } });
    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const filePath = path.join(getDataDir(), image.filename);
    if (existsSync(filePath)) await unlink(filePath);

    await prisma.slideshowImage.delete({ where: { id: imageId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Slideshow delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
