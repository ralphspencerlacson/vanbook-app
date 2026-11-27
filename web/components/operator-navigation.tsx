"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
export function OperatorNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className="operator-sidebar">
      <button
        className="operator-menu-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ☰ Operator menu
      </button>
      <nav aria-label="Operator portal" data-open={open}>
        {[
          ["requests", "Requests"],
          ["quoted", "Quoted"],
          ["booked", "Booked"],
          ["calendar", "Calendar"],
          ["vans", "My vans"],
          ["earnings", "Earnings"],
          ["documents", "Documents"],
          ["application", "Business profile"],
        ].map(([path, label]) => (
          <Link
            key={path}
            href={`/operator/${path}`}
            aria-current={pathname === `/operator/${path}` ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
