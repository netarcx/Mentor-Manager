import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    // JSON body: just update source setting (tba or none)
    if (contentType.includes("application/json")) {
      const { source } = await request.json();
      if (source !== "tba" && source !== "none") {
        return NextResponse.json({ error: "Invalid source" }, { status: 400 });
      }
      await prisma.setting.upsert({
        where: { key: "competition_robot_image_source" },
        update: { value: source },
        create: { key: "competition_robot_image_source", value: source },
      });
      revalidatePath("/", "layout");
      return NextResponse.json({ success: true, source });
    }

    // FormData: file upload
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
    const filename = `robot-image.${ext}`;
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, filename);

    // Remove old robot image if exists
    const oldSetting = await prisma.setting.findUnique({
      where: { key: "competition_robot_image_path" },
    });
    if (oldSetting?.value) {
      const oldPath = path.join(dataDir, oldSetting.value);
      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    }

    // Save new image
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Update settings
    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "competition_robot_image_path" },
        update: { value: filename },
        create: { key: "competition_robot_image_path", value: filename },
      }),
      prisma.setting.upsert({
        where: { key: "competition_robot_image_source" },
        update: { value: "upload" },
        create: { key: "competition_robot_image_source", value: "upload" },
      }),
    ]);

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, source: "upload", filename });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "competition_robot_image_path" },
    });
    if (setting?.value) {
      const dataDir = getDataDir();
      const filePath = path.join(dataDir, setting.value);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    }

    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "competition_robot_image_path" },
        update: { value: "" },
        create: { key: "competition_robot_image_path", value: "" },
      }),
      prisma.setting.upsert({
        where: { key: "competition_robot_image_source" },
        update: { value: "none" },
        create: { key: "competition_robot_image_source", value: "none" },
      }),
    ]);

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
