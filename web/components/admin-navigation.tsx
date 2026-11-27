"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primary = [
  ["/admin", "Verification", "verification"],
  ["/admin/bookings", "Booking", "bookings"],
  ["/admin/fees", "Fee ledger", "fees"],
  ["/admin/complaints", "Complaints", "complaints"],
  ["/admin/reports", "Reports", "reports"],
] as const;

function NavIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {name === "verification" ? (
        <>
          <path d="m10 2 6 2.5v5c0 3.5-3 6-6 8-3-2-6-4.5-6-8v-5z" />
          <path d="m7 9 2 2 4-4" />
        </>
      ) : name === "bookings" ? (
        <>
          <rect x="3" y="4" width="14" height="13" rx="2" />
          <path d="M6 2v4m8-4v4M3 9h14m-10 3h3" />
        </>
      ) : name === "fees" ? (
        <>
          <rect x="2" y="5" width="16" height="11" rx="2" />
          <path d="M2 9h16m-5 4h2" />
        </>
      ) : name === "complaints" ? (
        <>
          <path d="M17 12a2 2 0 0 1-2 2H8l-4 3v-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z" />
          <path d="M6 7h7M6 10h4" />
        </>
      ) : (
        <>
          <path d="M3 3v14h14M7 13V9m4 4V5m4 8v-6" />
        </>
      )}
    </svg>
  );
}

export function AdminNavigation({ waiting }: { waiting?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = (href: string) =>
    href === "/admin"
      ? pathname === href || pathname.startsWith("/admin/operators/")
      : pathname === href || pathname.startsWith(href + "/");
  return (
    <>
      <button
        className="admin-menu-toggle"
        aria-expanded={open}
        aria-controls="admin-navigation"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={open ? "m6 6 12 12M6 18 18 6" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
        <span>{open ? "Close menu" : "Menu"}</span>
      </button>
      <nav
        id="admin-navigation"
        className="admin-navigation"
        data-open={open}
        aria-label="Administration"
      >
        <div className="admin-nav-group">
          {primary.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              className="admin-nav-item"
              aria-current={current(href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <NavIcon name={icon} />
              <span>{label}</span>
              {href === "/admin" && waiting !== undefined && (
                <span className="admin-nav-count">{waiting}</span>
              )}
            </Link>
          ))}
        </div>
        <p className="admin-nav-caption">MANAGEMENT</p>
        <div className="admin-nav-group">
          {[
            ["/admin/documents", "Documents"],
            ["/admin/users", "Users"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="admin-nav-item"
              aria-current={current(href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                {href.endsWith("users") ? (
                  <>
                    <circle cx="10" cy="6" r="3" />
                    <path d="M4 17v-2a6 6 0 0 1 12 0v2" />
                  </>
                ) : (
                  <>
                    <rect x="4" y="2" width="12" height="16" rx="2" />
                    <path d="M7 7h6m-6 4h6m-6 3h4" />
                  </>
                )}
              </svg>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
