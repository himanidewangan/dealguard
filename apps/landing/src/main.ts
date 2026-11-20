import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "./style.css";
import { parseIncoming, type AnalysisResult, type CheckResult, type IncomingMessage, type Label } from "@dealguard/core";
import { buildReply, buildReportKit, CHECK_NAMES, runAnalysis, WEIGHTS, type CheckId } from "@dealguard/engine";

/** Build an element. Text goes in as text nodes only, never as HTML. */
function h(tag: string, attrs: Record<string, string> = {}, ...kids: (Node | string | null)[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c) e.append(c);
  return e;
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const SAMPLES: Record<string, string> = {
  s1: "From: Nike India Influencer Team <nikee.collabs@gmail.com>\nSubject: Paid collaboration for @yourhandle\n\nHi Creator,\n\nI'm from the Nike India influencer team. We loved your reels and want to pay you ₹40,000 for 2 reels and 3 stories.\n\nTo confirm your slot, please pay a refundable registration fee of ₹4,999 via UPI today. Slots are limited and expire at 6 PM.\n\nContinue on Telegram: t.me/nike_collab_desk\n\nRegards,\nAnanya, Marketing",
  s2: "From: Partnerships <collabs@nykaa-brand-collab.in>\nSubject: Brief for your Nykaa campaign\n\nDear Creator,\n\nYour profile has been shortlisted for our festive campaign (₹25,000 per reel).\n\nTo receive the brief and contract, sign in with Google here:\nhttps://nykaa-brand-collab.in/signin\n\nPlease complete this within 24 hours.",
  s3: "From: Priya Menon <priya@kaveritea.co.in>\nSubject: Collab brief: Monsoon chai range\n\nHi Aarav,\n\nI'm Priya from Kaveri Tea Co. We'd like to work with you on one 45-second reel for our monsoon chai range.\n\nDeliverables: 1 reel, 2 stories. Usage: organic only, 30 days. Fee: ₹18,000, paid within 15 days of go-live against your invoice.\n\nProduct will be couriered at our cost. Could you share your rate card and availability for the first two weeks of August?\n\nThanks,\nPriya Menon\nBrand Partnerships, Kaveri Tea Co.",
};

const CLASS: Record<Label, string> = { "Likely scam": "scam", Suspicious: "sus", "No red flags found": "none" };
const PILL = { fired: "● Fired", clear: "✓ Clear", unknown: "? Unknown" } as const;
const name = (c: CheckResult) => CHECK_NAMES[c.id as CheckId] ?? c.id;

function copyButton(getText: () => string): HTMLElement {
  const b = h("button", { class: "chip", type: "button" }, "Copy");
  b.addEventListener("click", () => {
    const done = (msg: string) => { b.textContent = msg; setTimeout(() => (b.textContent = "Copy"), 1500); };
    navigator.clipboard.writeText(getText()).then(() => done("Copied"), () => {
      const pre = b.closest(".panel")?.querySelector("pre");
      if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); }
      done("Selected, press copy");
    });
  });
  return b;
}

function render(m: IncomingMessage, r: AnalysisResult): void {
  const out = $("result");
  out.textContent = "";
  const fired = r.checks.filter((c) => c.status === "fired");
  const hard = fired.filter((c) => c.hardStop);
  const top = hard[0] ?? [...fired].sort((a, b) => b.points - a.points)[0];
  const cls = CLASS[r.label];
  const sub =
    r.label === "Likely scam" ? (hard[0] ? `Hard stop: ${name(hard[0]).toLowerCase()}.` : "The red flags add up past the Likely scam line.")
    : r.label === "Suspicious" ? "Several red flags. Don't pay or sign in until the sender is confirmed."
    : "None of the checks that could run found a problem. That doesn't confirm the offer is real.";
  out.append(h("div", { class: `verdict ${cls}` }, h("span", { class: "tag" }, "Verdict"), h("h3", {}, r.label), h("p", {}, sub), top && cls !== "none" ? h("p", { class: "why" }, top.evidence) : null));

  const ran = r.checks.filter((c) => c.status !== "unknown").length;
  out.append(h("div", { class: "meter-wrap" },
    h("div", { class: "meter-top" }, h("span", {}, `${r.score} points${r.hardStop ? " · hard stop overrides" : ""}`), h("span", { class: "muted" }, `${ran} of ${r.checks.length} checks could run`)),
    h("div", { class: "meter" },
      h("div", { class: `meter-fill ${cls}`, style: `width:${Math.min(100, r.score)}%` }),
      h("div", { class: "tick", style: "left:30%" }, h("span", {}, "30")),
      h("div", { class: "tick", style: "left:60%" }, h("span", {}, "60")))));

  const order = { fired: 0, unknown: 1, clear: 2 } as const;
  const list = h("ul", { class: "sigs" });
  for (const c of [...r.checks].sort((a, b) => order[a.status] - order[b.status] || b.points - a.points)) {
    const pts = c.status === "fired" && c.hardStop ? h("span", { class: "pts hard" }, "Hard stop") : c.status === "fired" ? h("span", { class: "pts" }, `+${c.points}`) : h("span", { class: "pts zero" }, "0");
    list.append(h("li", { class: "sig" }, h("span", { class: `pill ${c.status}` }, PILL[c.status]), h("div", {}, h("b", {}, name(c)), h("small", {}, c.evidence)), pts));
  }
  out.append(list);

  const reply = buildReply(r);
  out.append(h("div", { class: "panel" }, h("div", { class: "panel-head" }, h("span", { class: "eyebrow" }, "Safe reply"), copyButton(() => reply)), h("pre", { class: "text" }, reply)));
  if (cls !== "none") {
    const kit = buildReportKit(r, m);
    out.append(h("div", { class: "panel" }, h("div", { class: "panel-head" }, h("span", { class: "eyebrow" }, "Report kit"), copyButton(() => kit)), h("pre", { class: "text" }, kit),
      h("div", { class: "links" }, h("span", { class: "chip" }, "Helpline 1930"), h("a", { class: "chip", href: "https://cybercrime.gov.in", target: "_blank", rel: "noopener" }, "cybercrime.gov.in ↗"))));
  } else {
    out.append(h("div", { class: "panel" }, h("span", { class: "eyebrow" }, "Report kit"), h("p", { class: "muted" }, "Nothing to report. If the sender later asks for a fee or a login, paste the new message and check again.")));
  }
}

const msg = $<HTMLTextAreaElement>("msg");
function run(): void {
  if (msg.value.trim().length < 5) {
    $("result").textContent = "";
    $("result").append(h("div", { class: "panel" }, h("span", { class: "eyebrow" }, "No message yet"), h("p", { class: "muted" }, "Paste an email or DM, or pick a sample, then choose Check message.")));
    return;
  }
  const m = parseIncoming(msg.value.slice(0, 20000));
  render(m, runAnalysis(m));
}
const press = (id: string | null) => Object.keys(SAMPLES).forEach((k) => $(k).setAttribute("aria-pressed", String(k === id)));
for (const k of Object.keys(SAMPLES)) $(k).addEventListener("click", () => { press(k); msg.value = SAMPLES[k] ?? ""; run(); });
$("run").addEventListener("click", () => { press(Object.keys(SAMPLES).find((k) => SAMPLES[k] === msg.value) ?? null); run(); });
$("clear").addEventListener("click", () => { msg.value = ""; press(null); run(); msg.focus(); });

// Points chart, from the engine's own weights so the page and the extension cannot disagree.
const soft = (Object.keys(WEIGHTS) as CheckId[]).filter((id) => !WEIGHTS[id].hardStop).sort((a, b) => WEIGHTS[b].points - WEIGHTS[a].points);
for (const id of soft) {
  const p = WEIGHTS[id].points;
  $("bars").append(h("div", { class: "bar" }, h("span", {}, CHECK_NAMES[id]), h("div", { class: "track" }, h("i", { style: `width:${(p / 40) * 100}%` })), h("b", {}, String(p))));
}

press("s1");
msg.value = SAMPLES.s1 ?? "";
run();
