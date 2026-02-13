import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { text, author } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Quote text is required" },
        { status: 400 }
      );
    }

    await prisma.quote.create({
      data: {
        text: text.trim().slice(0, 500),
        author: (author || "").trim().slice(0, 100),
        active: false,
        pending: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
