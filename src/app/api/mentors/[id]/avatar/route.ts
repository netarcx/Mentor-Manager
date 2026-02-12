import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mentorId = parseInt(id);
    if (isNaN(mentorId)) {
      return new NextResponse(null, { status: 400 });
    }

    const mentor = await prisma.mentor.findUnique({
      where: { id: mentorId },
      select: { avatarPath: true },
    });

    if (!mentor?.avatarPath) {
      return new NextResponse(null, { status: 404 });
    }

    const dataDir = getDataDir();
    const filePath = path.join(dataDir, mentor.avatarPath);

    if (!existsSync(filePath)) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await readFile(filePath);
    const ext = mentor.avatarPath.split(".").pop()?.toLowerCase() || "png";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mentorId = parseInt(id);
    if (isNaN(mentorId)) {
      return NextResponse.json({ error: "Invalid mentor ID" }, { status: 400 });
    }

    const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } });
    if (!mentor) {
      return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

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
    const filename = `avatar-${mentorId}.${ext}`;
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, filename);

    // Remove old avatar if exists with different extension
    if (mentor.avatarPath && mentor.avatarPath !== filename) {
      const oldPath = path.join(dataDir, mentor.avatarPath);
      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    await prisma.mentor.update({
      where: { id: mentorId },
      data: { avatarPath: filename },
    });

    return NextResponse.json({ success: true, avatarPath: filename });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mentorId = parseInt(id);
    if (isNaN(mentorId)) {
      return NextResponse.json({ error: "Invalid mentor ID" }, { status: 400 });
    }

    const mentor = await prisma.mentor.findUnique({
      where: { id: mentorId },
      select: { avatarPath: true },
    });

    if (mentor?.avatarPath) {
      const dataDir = getDataDir();
      const filePath = path.join(dataDir, mentor.avatarPath);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    }

    await prisma.mentor.update({
      where: { id: mentorId },
      data: { avatarPath: "" },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
