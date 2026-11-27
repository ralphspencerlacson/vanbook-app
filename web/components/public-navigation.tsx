"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function PublicNavigation({ accountActions }: { accountActions: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 801px)");
    const resized = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    desktop.addEventListener("change", resized);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      desktop.removeEventListener("change", resized);
    };
  }, [open]);

  return (
    <div className="site-public-navigation" ref={root}>
      <Link
        href="/#get-quotes"
        className="site-button is-yellow site-mobile-quote"
        onClick={() => setOpen(false)}
      >
        Get quotes
      </Link>
      <button
        ref={toggle}
        type="button"
        className="site-menu-toggle"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d={open ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>
      <div
        id={panelId}
        className="site-navigation-panel"
        data-open={open}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
        }}
      >
        <nav className="site-header-links" aria-label="Main navigation">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#popular-routes">Popular routes</Link>
          <Link href="/#corporate">Corporate trips</Link>
          <Link href="/#for-operators">For operators</Link>
        </nav>
        <div className="site-header-actions">{accountActions}</div>
      </div>
    </div>
  );
}
