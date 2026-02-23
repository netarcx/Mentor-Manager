import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getBranding } from "@/lib/branding";
import { getCompetitionConfig } from "@/lib/tba";
import { prisma } from "@/lib/db";
import NavBrand from "@/components/NavBrand";
import NavDashboardLink from "@/components/NavDashboardLink";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata() {
  const branding = await getBranding();
  return {
    title: branding.appTitle,
    description: "Sign up for FRC workshop shifts",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [branding, competitionConfig, studentsEnabledSetting] = await Promise.all([
    getBranding(),
    getCompetitionConfig(),
    prisma.setting.findUnique({ where: { key: "student_attendance_enabled" } }),
  ]);

  const studentsEnabled = studentsEnabledSetting?.value === "true";

  const cssOverrides = `:root {
  --primary: ${branding.colorPrimary};
  --primary-dark: ${branding.colorPrimaryDark};
  --primary-light: ${branding.colorPrimaryLight};
  --navy: ${branding.colorNavy};
  --navy-dark: ${branding.colorNavyDark};
  --accent-bg: ${branding.colorAccentBg};
}`;

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssOverrides }} />
        <link rel="icon" href="/api/favicon" />
        <link rel="apple-touch-icon" sizes="180x180" href="/api/apple-icon" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <nav id="main-nav" className="bg-navy text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between min-h-16 py-2">
              <NavBrand initialName={branding.appName} />
              <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 sm:gap-6 text-xs sm:text-base">
                <Link
                  href="/signup"
                  className="font-semibold hover:text-primary-light transition-colors"
                >
                  Sign Up
                </Link>
                <NavDashboardLink className="font-semibold hover:text-primary-light transition-colors" />
                {studentsEnabled && (
                  <Link
                    href="/student"
                    className="font-semibold hover:text-primary-light transition-colors"
                  >
                    Students
                  </Link>
                )}
                {competitionConfig.enabled && (
                  <Link
                    href="/competition"
                    className="font-semibold hover:text-primary-light transition-colors"
                  >
                    Competition
                  </Link>
                )}
                <Link
                  href="/leaderboard"
                  className="font-semibold hover:text-primary-light transition-colors"
                >
                  Leaderboard
                </Link>
                <Link
                  href="/admin"
                  className="font-semibold hover:text-primary-light transition-colors"
                >
                  Admin
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
