import { AnalysisResult } from "@dealguard/core";
import type { CheckResult, IncomingMessage, Label } from "@dealguard/core";
import { runChecks } from "./checks.ts";
import { BANDS } from "./weights.ts";

/** The only place a verdict is decided. Models never touch this. */
export function score(checks: CheckResult[]): AnalysisResult {
  const hardStop = checks.some((c) => c.status === "fired" && c.hardStop);
  const total = Math.min(100, checks.reduce((n, c) => n + (c.status === "fired" ? c.points : 0), 0));
  const label: Label = hardStop || total >= BANDS.likelyScam ? "Likely scam" : total >= BANDS.suspicious ? "Suspicious" : "No red flags found";
  return { label, score: total, hardStop, checks };
}

export function runAnalysis(message: IncomingMessage): AnalysisResult {
  return AnalysisResult.parse(score(runChecks(message)));
}
