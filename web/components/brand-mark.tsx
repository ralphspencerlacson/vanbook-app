import Link from "next/link";

export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link className="welcome-brand" href={href} aria-label="VANBOOK PH home">
      <span className="welcome-brand-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M4 8.5h11.5l4 4v4H4z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M14.5 8.5V13h4.8M7 8.5V13H4"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="8" cy="17" r="1.8" fill="currentColor" />
          <circle cx="16" cy="17" r="1.8" fill="currentColor" />
        </svg>
      </span>
      <span>VANBOOK</span>
      <span className="welcome-country">PH</span>
    </Link>
  );
}
