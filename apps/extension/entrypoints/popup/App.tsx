import { useEffect, useRef, useState } from "react";
import { scrubNames, scrubPii, type AiResponse, type AnalysisResult, type CheckResult, type IncomingMessage, type Label } from "@dealguard/core";
import { buildReply, buildReportKit, CHECK_NAMES, type CheckId } from "@dealguard/engine";
import { analyzeAndSave } from "../../src/analyze.ts";
import { explain, explainConfigured } from "../../src/explain.ts";

const DRAFT_KEY = "dealguard:draft";

const VERDICT: Record<Label, { icon: string; box: string }> = {
  "Likely scam": { icon: "▲", box: "bg-coral text-ink" },
  Suspicious: { icon: "◆", box: "bg-butter text-ink" },
  "No red flags found": { icon: "○", box: "bg-sky text-ink" },
};

const STATUS = {
  fired: { icon: "●", word: "Fired", cls: "text-coral" },
  clear: { icon: "✓", word: "Clear", cls: "text-sky" },
  unknown: { icon: "?", word: "Unknown", cls: "text-muted" },
} as const;

type Ai = { state: "idle" | "streaming" | "done" | "error"; partial: string; final?: AiResponse; error?: string };

function CopyButton({ id, label, text }: { id: string; label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      id={id}
      type="button"
      className="btn border border-line bg-ink text-text"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

export default function App() {
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY) ?? "");
  const [result, setResult] = useState<AnalysisResult>();
  const [message, setMessage] = useState<IncomingMessage>();
  const [formError, setFormError] = useState("");
  const [ai, setAi] = useState<Ai>({ state: "idle", partial: "" });
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, text);
  }, [text]);

  async function check() {
    setAi({ state: "idle", partial: "" });
    setFormError("");
    if (!text.trim()) {
      setResult(undefined);
      setFormError("Paste a message first, then press Check message.");
      return;
    }
    try {
      const out = await analyzeAndSave(text);
      setResult(out.result);
      setMessage(out.message);
    } catch {
      setResult(undefined);
      setFormError("That message is too long to check. Paste the key part (under 20,000 characters).");
    }
  }

  async function runExplain() {
    if (!result) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setAi({ state: "streaming", partial: "" });
    try {
      const final = await explain(
        { text: scrubPii(scrubNames(text)).slice(0, 6000), label: result.label, firedChecks: result.checks.filter((c) => c.status === "fired").map((c) => c.id) },
        (partial) => setAi({ state: "streaming", partial }),
        abort.current.signal,
      );
      setAi({ state: "done", partial: final.explanation, final });
    } catch (e) {
      setAi({ state: "error", partial: "", error: e instanceof Error ? e.message : "The AI explanation failed. Try again." });
    }
  }

  async function copyReply() {
    if (!ai.final) return;
    await navigator.clipboard.writeText(ai.final.saferReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const v = result ? VERDICT[result.label] : undefined;

  return (
    <main className="flex flex-col gap-4 bg-ink p-4">
      <header>
        <h1 className="font-mono text-lg font-bold">DealGuard</h1>
        <p className="text-sm text-muted">Paste a brand-deal email or DM. The check runs on your device.</p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="label">Message</label>
        <textarea
          id="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={"From: name@example.com\nReply-To: ...\n\nPaste the full message here."}
          className="min-h-32 w-full resize-y rounded-input border border-line bg-well p-3 font-mono text-[13px] text-text"
          aria-describedby="message-help"
        />
        <p id="message-help" className="text-xs text-muted">Include the From and Reply-To lines if you can. Your draft is kept if you close this window.</p>
        {formError && <p role="alert" className="text-sm text-butter">{formError}</p>}
        <button id="check" type="button" onClick={check} className="btn bg-mint text-ink">Check message</button>
        <button id="open-dashboard" type="button" onClick={() => browser.runtime.openOptionsPage()} className="btn border border-line bg-ink text-text">Open dashboard</button>
      </div>

      {result && v && (
        <section aria-labelledby="verdict-h" className="flex flex-col gap-3">
          <div className={`rounded-card p-4 ${v.box}`}>
            <p id="verdict-h" className="label !text-ink">Verdict</p>
            <p className="font-mono text-xl font-bold"><span aria-hidden="true">{v.icon} </span>{result.label}</p>
            <p className="font-mono text-sm tabular-nums">Score {result.score} of 100{result.hardStop ? " · hard stop fired" : ""}</p>
          </div>
          {result.label === "No red flags found" && (
            <p className="text-sm text-muted">This is not a guarantee. Never pay money or share a code to get paid.</p>
          )}

          <ul className="flex flex-col gap-2">
            {result.checks.map((c: CheckResult) => {
              const s = STATUS[c.status];
              return (
                <li key={c.id} className="rounded-row bg-card p-3">
                  <p className="flex items-center justify-between gap-2 text-sm font-bold">
                    <span>{CHECK_NAMES[c.id as CheckId] ?? c.id}</span>
                    <span className={`font-mono text-xs ${s.cls}`}>{s.icon} {s.word}</span>
                  </p>
                  <p className="font-mono text-xs text-muted">{c.evidence}</p>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2 rounded-card bg-card p-4">
            <p className="label">Safe reply</p>
            <pre className="whitespace-pre-wrap rounded-row bg-well p-3 font-mono text-xs">{buildReply(result)}</pre>
            <CopyButton id="copy-safe-reply" label="Copy reply" text={buildReply(result)} />
          </div>
          {message && result.label !== "No red flags found" && (
            <div className="flex flex-col gap-2 rounded-card bg-card p-4">
              <p className="label">Report kit</p>
              <pre className="whitespace-pre-wrap rounded-row bg-well p-3 font-mono text-xs">{buildReportKit(result, message)}</pre>
              <CopyButton id="copy-report-kit" label="Copy report kit" text={buildReportKit(result, message)} />
            </div>
          )}
          {result.label !== "No red flags found" && (
            <p className="rounded-row bg-card p-3 text-sm">
              Lost money? Call <strong>1930</strong> or report at{" "}
              <a className="underline" href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>.
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-card bg-forest p-4">
            <h2 className="label !text-text">Explain with AI</h2>
            <p id="ai-notice" className="text-xs text-muted">
              Sends this message to the DealGuard server, which asks Claude to explain it. Emails, phone numbers, ID and card numbers, UPI IDs, link paths, @handles and most personal names are removed first. Name removal is best effort, so read the message before you send it. Nothing is stored.
            </p>
            {explainConfigured ? (
              <button id="explain" type="button" onClick={runExplain} disabled={ai.state === "streaming"} aria-describedby="ai-notice" className="btn bg-mint text-ink">
                {ai.state === "streaming" ? "Explaining…" : "Explain with AI"}
              </button>
            ) : (
              <p className="text-sm text-butter">AI explanation is not set up in this build.</p>
            )}
            {ai.state === "error" && <p role="alert" className="text-sm text-butter">{ai.error}</p>}
            {(ai.state === "streaming" || ai.state === "done") && (
              <div aria-live="polite" className="flex flex-col gap-2">
                <p className="text-sm">{ai.partial}</p>
                {ai.final && (
                  <>
                    <p className="label">Safer reply</p>
                    <p className="rounded-row bg-well p-3 font-mono text-xs">{ai.final.saferReply}</p>
                    <button id="copy" type="button" onClick={copyReply} className="btn border border-line bg-ink text-text">{copied ? "Copied" : "Copy reply"}</button>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
