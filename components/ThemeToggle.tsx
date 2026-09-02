"use client";

import { useLayoutEffect } from "react";

export default function ThemeToggle() {
  useLayoutEffect(() => {
    // In dev, React's Strict Mode remount resets <html> to only the
    // attributes it manages from JSX, clearing the data-theme the inline
    // script (layout.tsx) set before paint. Re-apply from localStorage here
    // — no-op in production, and no React state involved (the icon below is
    // pure CSS via the dark: variant, so there's nothing to re-sync).
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      // localStorage unavailable — nothing to re-apply
    }
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  function toggle() {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage unavailable — theme just won't persist across visits
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-sm hover:bg-surface-muted"
    >
      <span className="dark:hidden">🌙</span>
      <span className="hidden dark:inline">☀️</span>
    </button>
  );
}
