import type { Label } from "@dealguard/core";
import type { CheckRecord } from "@dealguard/db";

export const LABEL_ORDER: Label[] = ["Likely scam", "Suspicious", "No red flags found"];

export function verdictCounts(rows: CheckRecord[]): Record<Label, number> {
  const c: Record<Label, number> = { "Likely scam": 0, Suspicious: 0, "No red flags found": 0 };
  for (const r of rows) c[r.label] += 1;
  return c;
}

export function topFired(rows: CheckRecord[], limit = 5): { id: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const id of r.firedIds) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, limit);
}

/** Round the axis maximum up to 1, 2, 5 times a power of ten so ticks land on clean numbers. */
export function niceMax(n: number): number {
  if (n <= 5) return Math.max(n, 1);
  const p = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 5, 10].map((k) => k * p).find((v) => v >= n) ?? n);
}
