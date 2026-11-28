import Link from "next/link";
import { nextTableSort, tableSortDirection } from "@/lib/table-sort";

export function TableSortHeader({
  label,
  sort,
  ascending,
  descending,
  href,
  onSort,
}: {
  label: string;
  sort: string;
  ascending: string;
  descending: string;
  href?: string;
  onSort?: (value: string) => void;
}) {
  const direction = tableSortDirection(sort, ascending, descending);
  const content = (
    <>
      {label}
      <span aria-hidden="true">
        {direction === "ascending"
          ? "↑"
          : direction === "descending"
            ? "↓"
            : "↕"}
      </span>
    </>
  );
  return (
    <th scope="col" className="dashboard-sort-header" aria-sort={direction}>
      {href ? (
        <Link href={href} className="dashboard-sort-control" scroll={false}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className="dashboard-sort-control"
          onClick={() => onSort?.(nextTableSort(sort, ascending, descending))}
        >
          {content}
        </button>
      )}
    </th>
  );
}
