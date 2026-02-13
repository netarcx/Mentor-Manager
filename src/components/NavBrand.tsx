"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function NavBrand({ initialName }: { initialName: string }) {
  const [appName, setAppName] = useState(initialName);
  const [logoPath, setLogoPath] = useState("");

  useEffect(() => {
    fetch("/api/branding")
      .then((res) => res.json())
      .then((data) => {
        if (data.appName) setAppName(data.appName);
        if (data.logoPath !== undefined) setLogoPath(data.logoPath);
      })
      .catch(() => {});
  }, []);

  return (
    <Link href="/" className="font-bold text-xl text-primary-light flex items-center gap-2">
      {logoPath && (
        <img src="/api/logo" alt="" className="h-8 w-auto" />
      )}
      <span className="hidden sm:inline">{appName}</span>
    </Link>
  );
}
