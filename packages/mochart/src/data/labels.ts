/** Shared label guards for the chart-shape helpers. */

/**
 * Category values must be unique — `getDataErrors` rejects duplicates, which would blank the whole chart.
 * `key` decides which labels count as the same category (a date axis keys by instant); `text` names them in the error.
 */
export function checkUniqueLabels<T>(helperName: string, what: string, labels: readonly T[], key: (label: T) => string = String, text: (label: T) => string = String): void {
  const counts: Record<string, number> = Object.create(null); // null proto: keyed by user labels
  const duplicates: string[] = [];
  for (const label of labels) {
    const labelKey = key(label);
    counts[labelKey] = (counts[labelKey] ?? 0) + 1;
    if (counts[labelKey] === 2) {
      duplicates.push(text(label));
    }
  }
  if (duplicates.length > 0) {
    throw new Error(`${helperName}: ${what} must be unique, duplicates: ` + duplicates.join(', '));
  }
}
