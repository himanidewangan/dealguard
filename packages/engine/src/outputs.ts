import type { AnalysisResult, IncomingMessage } from "@dealguard/core";
import { BRANDS } from "./lists.ts";
import { CHECK_NAMES, type CheckId } from "./weights.ts";

const firedIds = (r: AnalysisResult) => r.checks.filter((c) => c.status === "fired").map((c) => c.id);

/** A reply the creator can send. Never claims the sender is trustworthy. */
export function buildReply(r: AnalysisResult): string {
  const ids = firedIds(r);
  if (ids.length === 0) {
    return "Hi, thanks for the details. Could you confirm the deliverables, usage rights, the payment amount and the payment date in writing? I will review and get back to you.";
  }
  const has = (...x: string[]) => x.some((i) => ids.includes(i));
  const bits = ["Hi, thanks for reaching out."];
  if (has("pay_request", "hinglish_payment")) bits.push("I don't pay any fee or deposit to take part in a collaboration.");
  if (has("offdomain_signin", "credentials")) bits.push("I don't sign in to links or share codes from messages.");
  if (has("offplatform")) bits.push("I keep deal talk on this thread.");
  bits.push("Please send the brief and contract from your official company email, with the brand's website and your full name and role. I will reply there.");
  return bits.join(" ");
}

/** Plain text the creator can paste into a report to 1930 or cybercrime.gov.in. */
export function buildReportKit(r: AnalysisResult, m: IncomingMessage, now: Date = new Date()): string {
  const flags = r.checks.filter((c) => c.status === "fired").map((c) => CHECK_NAMES[c.id as CheckId] ?? c.id);
  const brand = BRANDS.find((b) => new RegExp(`\\b${b.name}\\b`, "i").test(`${m.subject ?? ""}\n${m.text}`));
  const links = [...new Set([...m.text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((x) => (x[1] ?? "").toLowerCase()))];
  const tme = /\bt\.me\/|\bwa\.me\//i.test(m.text) && !links.length ? ["t.me"] : [];
  const date = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return [
    "Suspected fake brand-deal message",
    `Sender: ${m.from ? (m.from.match(/[\w.+-]+@[\w.-]+/)?.[0] ?? m.from) : "not shown"}`,
    `Claims to be: ${brand ? brand.name : "not identified"}`,
    `Red flags: ${flags.join("; ") || "nothing specific"}`,
    `Link domains: ${[...links, ...tme].join(", ") || "none"}`,
    `Date seen: ${date}`,
  ].join("\n");
}
