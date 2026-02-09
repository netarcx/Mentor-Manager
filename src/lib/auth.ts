import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SESSION_TTL } from "./constants";

interface SessionData {
  isAdmin: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || "this-is-a-fallback-secret-that-should-be-changed-in-production",
  cookieName: SESSION_COOKIE_NAME,
  ttl: SESSION_TTL,
  cookieOptions: {
    secure: process.env.COOKIE_SECURE === "true",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function createAdminSession(): Promise<void> {
  const session = await getSession();
  session.isAdmin = true;
  await session.save();
}

export async function destroyAdminSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isAdmin === true;
}
