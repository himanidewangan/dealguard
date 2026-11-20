import { AiResponse, type ExplainRequest } from "@dealguard/core";
import { partialExplanation, splitSse } from "./sse.ts";

const PROXY_URL = (import.meta.env.WXT_PROXY_URL as string | undefined) ?? "";
const TOKEN = (import.meta.env.WXT_INSTALL_TOKEN as string | undefined) ?? "";

export const explainConfigured = Boolean(PROXY_URL && TOKEN);

/** Send scrubbed text to the proxy and stream the explanation. Validates the final object with Zod. */
export async function explain(req: ExplainRequest, onPartial: (text: string) => void, signal?: AbortSignal): Promise<AiResponse> {
  let res: Response;
  try {
    res = await fetch(`${PROXY_URL}/explain`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-install-token": TOKEN },
      body: JSON.stringify(req),
    });
  } catch {
    throw new Error("Could not reach the DealGuard server. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const msg = await res.json().then((j: { error?: { message?: string } }) => j.error?.message).catch(() => undefined);
    throw new Error(msg ?? "The DealGuard server returned an error. Try again.");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let raw = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const { events, rest } = splitSse(buf);
    buf = rest;
    for (const e of events) {
      if (e.event === "delta") {
        raw += (JSON.parse(e.data) as { text: string }).text;
        onPartial(partialExplanation(raw));
      } else if (e.event === "done") {
        return AiResponse.parse(JSON.parse(e.data));
      } else if (e.event === "error") {
        throw new Error((JSON.parse(e.data) as { message?: string }).message ?? "The AI explanation failed. Try again.");
      }
    }
  }
  throw new Error("The AI explanation ended early. Try again.");
}
