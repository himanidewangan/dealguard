import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { parseIncoming, type AnalysisResult } from "@dealguard/core";
import { clearAll, deleteCheck, listChecks, saveCheck, watchChecks } from "./index.ts";

const result = (label: AnalysisResult["label"], score: number, fired: string[] = []): AnalysisResult => ({
  label,
  score,
  hardStop: false,
  checks: fired.map((id) => ({ id, status: "fired", points: 10, hardStop: false, evidence: "x", source: "local_rule" })),
});
const msg = (t: string) => parseIncoming(t);

beforeEach(async () => {
  await clearAll();
});

describe("check history", () => {
  it("saves a record with sender domain and fired ids, and lists newest first", async () => {
    await saveCheck(result("Suspicious", 35, ["urgency", "greeting"]), msg("From: A <a@brand.in>\n\nhello"), 1000);
    await saveCheck(result("No red flags found", 0), msg("plain text"), 2000);
    const rows = await listChecks();
    expect(rows.map((r) => r.createdAt)).toEqual([2000, 1000]);
    expect(rows[1]).toMatchObject({ label: "Suspicious", score: 35, firedIds: ["urgency", "greeting"], senderDomain: "brand.in" });
    expect(rows[0]?.senderDomain).toBe("");
  });
  it("deletes one record", async () => {
    const id = await saveCheck(result("Likely scam", 60), msg("pay a fee"), 1);
    await saveCheck(result("Suspicious", 30), msg("other"), 2);
    await deleteCheck(id);
    expect((await listChecks()).map((r) => r.createdAt)).toEqual([2]);
  });
  it("clears everything", async () => {
    await saveCheck(result("Suspicious", 30), msg("a"), 1);
    await clearAll();
    expect(await listChecks()).toEqual([]);
  });
  it("live query reports changes", async () => {
    const seen: number[] = [];
    const stop = watchChecks((rows) => seen.push(rows.length));
    await new Promise((r) => setTimeout(r, 30));
    await saveCheck(result("Suspicious", 30), msg("a"), 1);
    await new Promise((r) => setTimeout(r, 30));
    stop();
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(1);
  });
  it("drops rows that fail validation instead of crashing", async () => {
    const { db } = await import("./index.ts");
    await db.checks.put({ id: "bad", createdAt: 5 } as never);
    expect(await listChecks()).toEqual([]);
  });
});
