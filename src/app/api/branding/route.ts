import { NextResponse } from "next/server";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const branding = await getBranding();
    return NextResponse.json(branding);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
