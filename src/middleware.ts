import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { SESSION_COOKIE_NAME, SESSION_TTL } from "./lib/constants";

interface SessionData {
  isAdmin: boolean;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/dashboard")) {
    const response = NextResponse.next();
    const session = await getIronSession<SessionData>(request, response, {
      password:
        process.env.SESSION_SECRET ||
        "this-is-a-fallback-secret-that-should-be-changed-in-production",
      cookieName: SESSION_COOKIE_NAME,
      ttl: SESSION_TTL,
    });

    if (!session.isAdmin) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard/:path*"],
};
