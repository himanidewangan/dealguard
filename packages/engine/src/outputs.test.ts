import { describe, expect, it } from "vitest";
import { parseIncoming } from "@dealguard/core";
import { buildReply, buildReportKit, runAnalysis } from "./index.ts";

const go = (t: string) => {
  const m = parseIncoming(t);
  return { m, r: runAnalysis(m) };
};
const FEE = "From: Nike Team <n@gmail.com>\n\nHi Creator, pay a registration fee of ₹4,999. Continue on Telegram: https://t.me/x";

describe("buildReply", () => {
  it("refuses fees and asks for official email when a fee was requested", () => {
    const { r } = go(FEE);
    const text = buildReply(r);
    expect(text).toContain("any fee or deposit");
    expect(text).toContain("official company email");
  });
  it("asks for written terms when nothing fired, and never says safe", () => {
    const { r } = go("Hi Aarav, one reel for ₹10,000 paid in 15 days.");
    const text = buildReply(r);
    expect(text).toContain("in writing");
    expect(text.toLowerCase()).not.toMatch(/\b(safe|legit|genuine)\b/);
  });
});

describe("buildReportKit", () => {
  it("lists sender, red flags and link domains", () => {
    const { m, r } = go(FEE);
    const kit = buildReportKit(r, m, new Date("2026-01-05T00:00:00Z"));
    expect(kit).toContain("Sender: n@gmail.com");
    expect(kit).toContain("Asks you to pay first");
    expect(kit).toContain("t.me");
    expect(kit).toContain("Date seen:");
  });
  it("says not shown when there is no sender", () => {
    const { m, r } = go("Pay a registration fee of ₹100");
    expect(buildReportKit(r, m)).toContain("Sender: not shown");
  });
});
