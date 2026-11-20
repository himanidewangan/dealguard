import { parseIncoming } from "@dealguard/core";
import { runAnalysis } from "../src/index.ts";
import { FIXTURES } from "../fixtures/index.ts";

let tp = 0, fp = 0, fn = 0, tn = 0;
const wrong: string[] = [];
for (const f of FIXTURES) {
  const r = runAnalysis(parseIncoming(f.text));
  const flagged = r.label !== "No red flags found";
  if (f.kind === "scam" && flagged) tp++;
  else if (f.kind === "scam") { fn++; wrong.push(`${f.id}: scam missed, got ${r.label} (${r.score})`); }
  else if (flagged) { fp++; wrong.push(`${f.id}: genuine flagged, got ${r.label} (${r.score})`); }
  else tn++;
}
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(0)}%`);
console.log(`fixtures ${FIXTURES.length}  tp ${tp}  fp ${fp}  fn ${fn}  tn ${tn}`);
console.log(`precision ${pct(tp, tp + fp)}  recall ${pct(tp, tp + fn)}`);
console.log(wrong.length ? `misclassified:\n  ${wrong.join("\n  ")}` : "misclassified: none");
