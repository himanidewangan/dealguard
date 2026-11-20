import { describe, expect, it } from "vitest";
import type { CheckRecord } from "@dealguard/db";
import { niceMax, topFired, verdictCounts } from "./stats.ts";

const row = (label: CheckRecord["label"], firedIds: string[] = []): CheckRecord => ({ id: Math.random().toString(), createdAt: 1, label, score: 0, hardStop: false, firedIds, senderDomain: "", text: "" });

describe("stats", () => {
  it("counts verdicts including zeros", () => {
    expect(verdictCounts([row("Suspicious"), row("Suspicious"), row("Likely scam")])).toEqual({ "Likely scam": 1, Suspicious: 2, "No red flags found": 0 });
  });
  it("ranks fired checks by count then id", () => {
    expect(topFired([row("Suspicious", ["b", "a"]), row("Suspicious", ["b"])])).toEqual([{ id: "b", count: 2 }, { id: "a", count: 1 }]);
  });
  it("rounds the axis max up to a clean number", () => {
    expect([niceMax(0), niceMax(3), niceMax(7), niceMax(13), niceMax(61)]).toEqual([1, 3, 10, 20, 100]);
  });
});
