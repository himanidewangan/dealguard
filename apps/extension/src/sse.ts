export interface SseEvent {
  event: string;
  data: string;
}

/** Split a buffer into complete SSE events and the unfinished remainder. */
export function splitSse(buffer: string): { events: SseEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events = parts.flatMap((block) => {
    const event = block.split("\n").find((l) => l.startsWith("event:"))?.slice(6).trim();
    const data = block.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim();
    return event && data ? [{ event, data }] : [];
  });
  return { events, rest };
}

/** Read the explanation text out of a partly streamed JSON object so it can show while it arrives. */
export function partialExplanation(raw: string): string {
  const m = raw.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return "";
  const s = (m[1] ?? "").replace(/\\$/, "");
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
}
