export interface LogEntry {
  route: string;
  status: number;
  latencyMs: number;
  tokenId?: string;
}

/** SHA-256 of the install id, first 12 hex chars. */
export async function hashId(id: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return [...new Uint8Array(d)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The only logger. Its type has no field for message text, senders or links, so they cannot be logged. */
export function log(entry: LogEntry): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}
