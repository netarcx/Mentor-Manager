import "server-only";
import { cache } from "react";
import { prisma } from "./db";

export interface Branding {
  appName: string;
  appTitle: string;
  colorPrimary: string;
  colorPrimaryDark: string;
  colorPrimaryLight: string;
  colorNavy: string;
  colorNavyDark: string;
  colorAccentBg: string;
  logoPath: string;
  faviconPath: string;
}

const defaults: Branding = {
  appName: "FRC Workshop Signup",
  appTitle: "FRC Workshop Signup",
  colorPrimary: "#51077a",
  colorPrimaryDark: "#3b0559",
  colorPrimaryLight: "#c084fc",
  colorNavy: "#2d3748",
  colorNavyDark: "#1a202c",
  colorAccentBg: "#f3e8ff",
  logoPath: "",
  faviconPath: "",
};

const keyMap: Record<string, keyof Branding> = {
  app_name: "appName",
  app_title: "appTitle",
  color_primary: "colorPrimary",
  color_primary_dark: "colorPrimaryDark",
  color_primary_light: "colorPrimaryLight",
  color_navy: "colorNavy",
  color_navy_dark: "colorNavyDark",
  color_accent_bg: "colorAccentBg",
  logo_path: "logoPath",
  favicon_path: "faviconPath",
};

export function getDefaultBranding(): Branding {
  return { ...defaults };
}

async function fetchBrandingFromDb(): Promise<Branding> {
  try {
    const keys = Object.keys(keyMap);
    const settings = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });

    const branding = { ...defaults };
    for (const setting of settings) {
      const field = keyMap[setting.key];
      if (field && setting.value) {
        branding[field] = setting.value;
      }
    }

    return branding;
  } catch {
    // DB not available (e.g. during Docker build / static generation)
    return { ...defaults };
  }
}

// React.cache() deduplicates calls within a single server render pass
// (so generateMetadata + RootLayout share one call per request)
export const getBranding = cache(fetchBrandingFromDb);

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color);
}
