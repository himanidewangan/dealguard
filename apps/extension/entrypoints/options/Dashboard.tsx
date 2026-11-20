import { useEffect, useMemo, useState } from "react";
import type { Label } from "@dealguard/core";
import { clearAll, deleteCheck, watchChecks, type CheckRecord } from "@dealguard/db";
import { buildReply, buildReportKit, CHECK_NAMES, type CheckId } from "@dealguard/engine";
import { analyzeText } from "../../src/analyze.ts";
import { LABEL_ORDER, niceMax, topFired, verdictCounts } from "../../src/stats.ts";

const BAR: Record<Label, string> = { "Likely scam": "bg-coral", Suspicious: "bg-butter", "No red flags found": "bg-sky" };
const ICON: Record<Label, string> = { "Likely scam": "▲", Suspicious: "◆", "No red flags found": "○" };
const STATUS = { fired: "● Fired", clear: "✓ Clear", unknown: "? Unknown" } as const;
const when = (t: number) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [rows, setRows] = useState<CheckRecord[]>([]);
  const [openId, setOpenId] = useState<string>();
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => watchChecks(setRows), []);

  const counts = useMemo(() => verdictCounts(rows), [rows]);
  const top = useMemo(() => topFired(rows), [rows]);
  const axisMax = niceMax(Math.max(...Object.values(counts)));
  const ticks = [0, axisMax / 2, axisMax].filter((v, i, a) => a.indexOf(v) === i);
  const topMax = Math.max(1, ...top.map((t) => t.count));
  const open = rows.find((r) => r.id === openId);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-mono text-xl font-bold">DealGuard dashboard</h1>
        <button id="logout" type="button" onClick={onLogout} className="btn border border-line bg-ink text-text">Sign out</button>
      </header>
      <p className="text-sm text-muted">Everything here is stored on this device. Nothing is sent anywhere unless you press Explain with AI in the popup.</p>

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Checks" value={rows.length} />
        {LABEL_ORDER.map((l) => <Tile key={l} label={l} value={counts[l]} icon={ICON[l]} />)}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="chart-h" className="rounded-card bg-card p-6">
          <h2 id="chart-h" className="label mb-4">Verdicts by count</h2>
          <ul className="flex flex-col gap-2">
            {LABEL_ORDER.map((l) => (
              <li key={l} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2">
                <span className="font-mono text-xs"><span aria-hidden="true">{ICON[l]} </span>{l}</span>
                <span className="h-4 rounded-r-[4px] bg-transparent">
                  <span className={`block h-4 rounded-r-[4px] ${BAR[l]}`} style={{ width: `${(counts[l] / axisMax) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-xs tabular-nums">{counts[l]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-[9rem_1fr_2rem] gap-2" aria-hidden="true">
            <span />
            <span className="relative h-5 border-t border-line">
              {ticks.map((t) => (
                <span key={t} className="absolute top-1 font-mono text-[11px] tabular-nums text-muted" style={{ left: `${(t / axisMax) * 100}%`, transform: t === axisMax ? "translateX(-100%)" : t === 0 ? undefined : "translateX(-50%)" }}>{t}</span>
              ))}
            </span>
            <span />
          </div>
          <p className="mt-2 text-center font-mono text-[11px] text-muted">Number of checks</p>
        </section>

        <section aria-labelledby="top-h" className="rounded-card bg-forest p-6">
          <h2 id="top-h" className="label !text-text mb-4">Most fired checks</h2>
          {top.length === 0 ? <p className="text-sm text-muted">No checks fired yet.</p> : (
            <ul className="flex flex-col gap-2">
              {top.map((t) => (
                <li key={t.id} className="grid grid-cols-[1fr_6rem_2rem] items-center gap-2">
                  <span className="text-sm">{CHECK_NAMES[t.id as CheckId] ?? t.id}</span>
                  <span className="h-3"><span className="block h-3 rounded-r-[4px] bg-butter" style={{ width: `${(t.count / topMax) * 100}%` }} /></span>
                  <span className="text-right font-mono text-xs tabular-nums">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="hist-h" className="rounded-card bg-card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="hist-h" className="label">History</h2>
          {rows.length > 0 && (
            confirmClear ? (
              <span className="flex gap-2">
                <button id="clear-confirm" type="button" className="btn bg-coral text-ink" onClick={async () => { await clearAll(); setConfirmClear(false); setOpenId(undefined); }}>Delete all {rows.length} checks</button>
                <button type="button" className="btn border border-line bg-ink text-text" onClick={() => setConfirmClear(false)}>Cancel</button>
              </span>
            ) : (
              <button id="clear" type="button" className="btn border border-line bg-ink text-text" onClick={() => setConfirmClear(true)}>Clear history</button>
            )
          )}
        </div>
        {rows.length === 0 ? <p className="text-sm text-muted">No checks yet. Open the popup, paste a message and press Check message.</p> : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? undefined : r.id)} className="grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-2 rounded-row bg-well p-3 text-left">
                  <span>
                    <span className="block font-mono text-sm font-bold"><span aria-hidden="true">{ICON[r.label]} </span>{r.label} · <span className="tabular-nums">{r.score}</span></span>
                    <span className="block font-mono text-xs text-muted">{r.senderDomain || "no sender shown"} · {when(r.createdAt)}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">{openId === r.id ? "Hide" : "Details"}</span>
                </button>
                {open?.id === r.id && <Detail row={open} onDelete={async () => { await deleteCheck(r.id); setOpenId(undefined); }} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Tile({ label, value, icon }: { label: string; value: number; icon?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-card p-4">
      <p className="label">{icon && <span aria-hidden="true">{icon} </span>}{label}</p>
      <p className="font-mono text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Detail({ row, onDelete }: { row: CheckRecord; onDelete: () => void }) {
  const { message, result } = useMemo(() => analyzeText(row.text), [row.text]);
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-row bg-ink p-4">
      <ul className="flex flex-col gap-2">
        {result.checks.map((c) => (
          <li key={c.id} className="rounded-row bg-card p-3">
            <p className="flex justify-between gap-2 text-sm font-bold"><span>{CHECK_NAMES[c.id as CheckId] ?? c.id}</span><span className="font-mono text-xs">{STATUS[c.status]}</span></p>
            <p className="font-mono text-xs text-muted">{c.evidence}</p>
          </li>
        ))}
      </ul>
      <p className="label">Safe reply</p>
      <pre className="whitespace-pre-wrap rounded-row bg-well p-3 font-mono text-xs">{buildReply(result)}</pre>
      {result.label !== "No red flags found" && (
        <>
          <p className="label">Report kit</p>
          <pre className="whitespace-pre-wrap rounded-row bg-well p-3 font-mono text-xs">{buildReportKit(result, message, new Date(row.createdAt))}</pre>
        </>
      )}
      <button type="button" onClick={onDelete} className="btn self-start border border-line bg-ink text-text">Delete this check</button>
    </div>
  );
}
