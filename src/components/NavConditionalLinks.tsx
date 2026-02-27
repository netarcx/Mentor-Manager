"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function NavConditionalLinks({
  className,
}: {
  className?: string;
}) {
  const [flags, setFlags] = useState<{
    competition: boolean;
    students: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/nav-flags")
      .then((r) => r.json())
      .then(setFlags)
      .catch(() => {});
  }, []);

  if (!flags) return null;

  return (
    <>
      {flags.students && (
        <Link href="/student" className={className}>
          Students
        </Link>
      )}
      {flags.competition && (
        <Link href="/competition" className={className}>
          Competition
        </Link>
      )}
    </>
  );
}
