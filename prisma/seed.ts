import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  // Seed admin password (only if not already set)
  const existing = await prisma.setting.findUnique({
    where: { key: "admin_password" },
  });

  if (!existing) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "changeme";
    const hash = await bcryptjs.hash(defaultPassword, 10);

    await prisma.setting.create({
      data: { key: "admin_password", value: hash },
    });

    console.log(`Admin password set (default: "${defaultPassword}")`);
  } else {
    console.log("Admin password already exists, skipping");
  }

  // Seed default branding values (only if not already set)
  const brandingDefaults: Record<string, string> = {
    app_name: "UV PitCrew",
    app_title: "UV PitCrew",
    color_primary: "#51077a",
    color_primary_dark: "#3b0559",
    color_primary_light: "#c084fc",
    color_navy: "#2d3748",
    color_navy_dark: "#1a202c",
    color_accent_bg: "#f3e8ff",
  };

  for (const [key, value] of Object.entries(brandingDefaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log("Default branding settings seeded");

  // Seed default notification settings (only if not already set)
  const notificationDefaults: Record<string, string> = {
    notifications_enabled: "false",
    notifications_smtp_url: "",
    notifications_broadcast_urls: "",
    notifications_reminder_day: "1",
    notifications_reminder_time: "09:00",
    notifications_look_ahead_days: "7",
    notifications_last_reminder_sent: "",
  };

  for (const [key, value] of Object.entries(notificationDefaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log("Default notification settings seeded");

  // Seed a default season if none exists
  const seasonCount = await prisma.season.count();
  if (seasonCount === 0) {
    await prisma.season.create({
      data: {
        name: "2026 Build Season",
        startDate: "2026-01-06",
        endDate: "2026-04-15",
      },
    });
    console.log("Default season created: 2026 Build Season");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
