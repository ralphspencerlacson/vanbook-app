export function nextTableSort(
  current: string,
  ascending: string,
  descending: string,
) {
  return current === ascending ? descending : ascending;
}

export function tableSortDirection(
  current: string,
  ascending: string,
  descending: string,
) {
  return current === ascending
    ? "ascending"
    : current === descending
      ? "descending"
      : undefined;
}
