import { IncomingMessage } from "./schemas.ts";

const HEADER = /^(from|reply-to|subject):[ \t]*(.+)$/gim;

/** Build an IncomingMessage from pasted text. Reads From, Reply-To and Subject lines if present. */
export function parseIncoming(raw: string): IncomingMessage {
  const out: { from?: string; replyTo?: string; subject?: string } = {};
  for (const m of raw.slice(0, 2000).matchAll(HEADER)) {
    const key = (m[1] ?? "").toLowerCase();
    const val = (m[2] ?? "").trim();
    if (key === "from") out.from ??= val;
    else if (key === "reply-to") out.replyTo ??= val;
    else out.subject ??= val;
  }
  return IncomingMessage.parse({ source: "paste", text: raw.trim(), ...out });
}

/** Lowercase domain of "Name <a@b.com>" or "a@b.com". Undefined when there is none. */
export function domainOf(address: string | undefined): string | undefined {
  const m = address?.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return m?.[1]?.toLowerCase();
}
