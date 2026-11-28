"use client";

import { useId, useState, type ReactNode } from "react";

export function DashboardFilters({
  children,
  activeCount = 0,
  defaultOpen = false,
}: {
  children: ReactNode;
  activeCount?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="dashboard-filters">
      <div className="dashboard-filter-toolbar">
        <button
          type="button"
          className="dashboard-filter-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 5h14M5 10h10M8 15h4" />
          </svg>
          Filters
          {activeCount > 0 && (
            <>
              <span className="dashboard-filter-count" aria-hidden="true">
                {activeCount}
              </span>
              <span className="sr-only">{activeCount} active filters</span>
            </>
          )}
          <svg
            className="dashboard-filter-chevron"
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="m6 8 4 4 4-4" />
          </svg>
        </button>
        {!open && activeCount > 0 && (
          <span className="dashboard-filter-summary">Filters applied</span>
        )}
      </div>
      <div id={id} hidden={!open} className="dashboard-filter-content">
        {children}
      </div>
    </div>
  );
}
