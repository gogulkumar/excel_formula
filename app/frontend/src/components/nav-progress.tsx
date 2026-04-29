"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const id = window.setTimeout(() => setActive(false), 420);
    return () => window.clearTimeout(id);
  }, [pathname, searchParams]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1">
      <div className={`h-full bg-[linear-gradient(90deg,#f97316_0%,#ea580c_50%,#7C3AED_100%)] transition-all duration-500 ${active ? "w-full opacity-100" : "w-0 opacity-0"}`} />
    </div>
  );
}
