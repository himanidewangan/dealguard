import { BRANDS, SECOND_LEVEL } from "./lists.ts";

type Brand = (typeof BRANDS)[number];
export type Lookalike = { official: Brand } | { brand: Brand; why: string } | null;

/** Registrable domain: a.b.example.co.in -> example.co.in */
export function registrable(host: string): string {
  const p = host.toLowerCase().replace(/\.$/, "").split(".");
  if (p.length <= 2) return p.join(".");
  const sl = p[p.length - 2] ?? "";
  const tld = p[p.length - 1] ?? "";
  return SECOND_LEVEL.includes(sl) && tld.length === 2 ? p.slice(-3).join(".") : p.slice(-2).join(".");
}

const norm = (s: string) => s.replace(/rn/g, "m").replace(/vv/g, "w").replace(/0/g, "o").replace(/1/g, "l").replace(/\|/g, "l");

/** Damerau-Levenshtein distance. Inputs are short domain labels. */
export function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

export function lookalike(host: string): Lookalike {
  const reg = registrable(host);
  const official = BRANDS.find((b) => b.domains.includes(reg));
  if (official) return { official };
  const lab = reg.split(".")[0] ?? "";
  const nl = norm(lab);
  const parts = lab.split("-");
  for (const b of BRANDS) {
    if (lab !== b.label && nl === b.label) return { brand: b, why: `look-alike characters for ${b.label}` };
    if (lab !== b.label && lab.length >= 4 && distance(lab, b.label) === 1) return { brand: b, why: `one letter away from ${b.label}` };
    if (parts.length > 1 && parts.some((p) => p === b.label || (p.length >= 4 && distance(p, b.label) === 1))) return { brand: b, why: "brand name inside an unofficial domain" };
  }
  const subs = host.toLowerCase().split(".").slice(0, -reg.split(".").length);
  for (const b of BRANDS) if (subs.includes(b.label)) return { brand: b, why: "brand name used as a subdomain" };
  for (const b of BRANDS) if (lab === b.label) return { brand: b, why: "right name, wrong domain ending" };
  return null;
}
