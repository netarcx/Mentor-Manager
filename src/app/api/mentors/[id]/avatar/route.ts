import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_SIZE = 256;

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
    const mentorId = parseInt(id, 10);
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

    const raw = await readFile(filePath);
    const metadata = await sharp(raw).metadata();
    let buffer: Buffer;
    let contentType: string;

    if ((metadata.width && metadata.width > AVATAR_SIZE) || (metadata.height && metadata.height > AVATAR_SIZE) || metadata.format !== "webp") {
      buffer = await sharp(raw)
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();
      contentType = "image/webp";
      // Re-save the optimized version so next request is fast
      await writeFile(filePath, buffer).catch(() => {});
    } else {
      buffer = raw;
      contentType = "image/webp";
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mentorId = parseInt(id, 10);
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

    const filename = `avatar-${mentorId}.webp`;
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, filename);

    // Remove old avatar if exists with different extension
    if (mentor.avatarPath && mentor.avatarPath !== filename) {
      const oldPath = path.join(dataDir, mentor.avatarPath);
      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const buffer = await sharp(rawBuffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    await writeFile(filePath, buffer);

    await prisma.mentor.update({
      where: { id: mentorId },
      data: { avatarPath: filename },
    });

    return NextResponse.json({ success: true, avatarPath: filename });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mentorId = parseInt(id, 10);
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
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
