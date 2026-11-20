import Dexie, { liveQuery, type EntityTable } from "dexie";
import { z } from "zod";
import { domainOf, Label, type AnalysisResult, type IncomingMessage } from "@dealguard/core";

/** One saved check. The message text stays on this device. */
export const CheckRecord = z.object({
  id: z.string(),
  createdAt: z.number(),
  label: Label,
  score: z.number(),
  hardStop: z.boolean(),
  firedIds: z.array(z.string()),
  senderDomain: z.string(),
  text: z.string(),
});
export type CheckRecord = z.infer<typeof CheckRecord>;

class DealGuardDb extends Dexie {
  checks!: EntityTable<CheckRecord, "id">;
  constructor() {
    super("dealguard");
    this.version(1).stores({ checks: "id, createdAt" });
  }
}
export const db = new DealGuardDb();

const valid = (rows: unknown[]): CheckRecord[] => rows.flatMap((r) => { const p = CheckRecord.safeParse(r); return p.success ? [p.data] : []; });

export async function saveCheck(result: AnalysisResult, message: IncomingMessage, now: number = Date.now()): Promise<string> {
  const id = crypto.randomUUID();
  await db.checks.add({
    id,
    createdAt: now,
    label: result.label,
    score: result.score,
    hardStop: result.hardStop,
    firedIds: result.checks.filter((c) => c.status === "fired").map((c) => c.id),
    senderDomain: domainOf(message.from) ?? "",
    text: message.text,
  });
  return id;
}

export async function listChecks(): Promise<CheckRecord[]> {
  return valid(await db.checks.orderBy("createdAt").reverse().toArray());
}
export const deleteCheck = (id: string) => db.checks.delete(id);
export const clearAll = () => db.checks.clear();

/** Calls `cb` now and after every change. Returns an unsubscribe function. */
export function watchChecks(cb: (rows: CheckRecord[]) => void): () => void {
  const sub = liveQuery(() => db.checks.orderBy("createdAt").reverse().toArray()).subscribe({ next: (rows) => cb(valid(rows)), error: () => cb([]) });
  return () => sub.unsubscribe();
}
