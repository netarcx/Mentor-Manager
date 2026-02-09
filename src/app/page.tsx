import Link from "next/link";
import { getBranding } from "@/lib/branding";

export default async function Home() {
  const branding = await getBranding();

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        {branding.logoPath && (
          <img
            src="/api/logo"
            alt={branding.appName}
            className="h-24 w-auto mx-auto mb-6"
          />
        )}
        <h1 className="text-5xl font-bold mb-4">
          Welcome to the{" "}
          <span className="text-primary">{branding.appName}</span>
        </h1>
        <p className="text-xl text-slate-600">
          Sign up for shifts, see who&apos;s in the shop, and track your hours.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Link
          href="/signup"
          className="block bg-primary hover:bg-primary-dark text-white rounded-xl p-8 text-center transition-colors shadow-lg"
        >
          <div className="text-4xl mb-3">&#9997;</div>
          <h2 className="text-xl font-bold mb-2">Sign Up</h2>
          <p className="text-sm opacity-90">
            Pick your shifts and let the team know you&apos;ll be there
          </p>
        </Link>

        <Link
          href="/dashboard"
          className="block bg-navy hover:bg-navy-dark text-white rounded-xl p-8 text-center transition-colors shadow-lg"
        >
          <div className="text-4xl mb-3">&#128250;</div>
          <h2 className="text-xl font-bold mb-2">Dashboard</h2>
          <p className="text-sm opacity-90">
            See who&apos;s in the shop right now and next shift
          </p>
        </Link>

        <Link
          href="/leaderboard"
          className="block bg-slate-700 hover:bg-slate-800 text-white rounded-xl p-8 text-center transition-colors shadow-lg"
        >
          <div className="text-4xl mb-3">&#127942;</div>
          <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
          <p className="text-sm opacity-90">
            Track hours and see who&apos;s putting in the most time
          </p>
        </Link>
      </div>
    </div>
  );
}
