import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getBranding } from "@/lib/branding";
import NavBrand from "@/components/NavBrand";
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
  const branding = await getBranding();

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
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <nav id="main-nav" className="bg-navy text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <NavBrand initialName={branding.appName} />
              <div className="flex gap-6">
                <Link
                  href="/signup"
                  className="font-semibold hover:text-primary-light transition-colors"
                >
                  Sign Up
                </Link>
                <Link
                  href="/dashboard"
                  className="font-semibold hover:text-primary-light transition-colors"
                >
                  Dashboard
                </Link>
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
