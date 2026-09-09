/** Shared label guards for the chart-shape helpers. */

/** Category values must be unique — `getDataErrors` rejects duplicates, which would blank the whole chart. */
export function checkUniqueLabels(helperName: string, what: string, labels: readonly string[]): void {
  const counts: Record<string, number> = Object.create(null); // null proto: keyed by user labels
  const duplicates: string[] = [];
  for (const label of labels) {
    counts[label] = (counts[label] ?? 0) + 1;
    if (counts[label] === 2) {
      duplicates.push(label);
    }
  }
  if (duplicates.length > 0) {
    throw new Error(`${helperName}: ${what} must be unique, duplicates: ` + duplicates.join(', '));
  }
}
