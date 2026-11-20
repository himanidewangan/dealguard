import { parseIncoming, type AnalysisResult, type IncomingMessage } from "@dealguard/core";
import { runAnalysis } from "@dealguard/engine";
import { saveCheck } from "@dealguard/db";

/** Pure analysis, used to re-open a saved check. */
export function analyzeText(raw: string): { message: IncomingMessage; result: AnalysisResult } {
  const message = parseIncoming(raw);
  return { message, result: runAnalysis(message) };
}

/** The single ingestion path. Every way of getting a message into DealGuard ends here: analyse, then save. */
export async function analyzeAndSave(raw: string): Promise<{ message: IncomingMessage; result: AnalysisResult }> {
  const out = analyzeText(raw);
  try {
    await saveCheck(out.result, out.message);
  } catch {
    // History is a convenience. A storage failure must not hide the verdict.
  }
  return out;
}
