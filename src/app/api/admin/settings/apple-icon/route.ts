import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

function getDataDir(): string {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("/app/data/")) {
    return "/app/data";
  }
  return path.resolve(process.cwd(), "data");
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("apple-icon") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPG, WebP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const filename = `apple-icon.${ext}`;
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, filename);

    // Remove old icon if exists
    const oldSetting = await prisma.setting.findUnique({ where: { key: "apple_icon_path" } });
    if (oldSetting?.value) {
      const oldPath = path.join(dataDir, oldSetting.value);
      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    }

    // Ensure data directory exists
    await mkdir(dataDir, { recursive: true });

    // Save new icon
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Store just the filename in settings
    await prisma.setting.upsert({
      where: { key: "apple_icon_path" },
      update: { value: filename },
      create: { key: "apple_icon_path", value: filename },
    });

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, appleIconPath: filename });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.setting.findUnique({ where: { key: "apple_icon_path" } });
    if (setting?.value) {
      const dataDir = getDataDir();
      const filePath = path.join(dataDir, setting.value);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    }

    await prisma.setting.upsert({
      where: { key: "apple_icon_path" },
      update: { value: "" },
      create: { key: "apple_icon_path", value: "" },
    });

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
