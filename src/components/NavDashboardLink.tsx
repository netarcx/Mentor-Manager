"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NavDashboardLink({ className }: { className?: string }) {
  const router = useRouter();
  const lastTapRef = useRef(0);

  function handleClick(e: React.MouseEvent) {
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      e.preventDefault();
      lastTapRef.current = 0;
      router.push("/dashboard?tv=1");
    } else {
      lastTapRef.current = now;
    }
  }

  return (
    <Link href="/dashboard" className={className} onClick={handleClick}>
      Dashboard
    </Link>
  );
}
