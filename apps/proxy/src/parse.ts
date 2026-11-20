import { AiResponse, ExplainRequest, scrubNames, scrubPii } from "@dealguard/core";
import { MAX_BODY_BYTES } from "./config.ts";
import { ApiError } from "./errors.ts";

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Read and validate the request body. Unknown fields, oversize bodies and bad JSON are rejected. */
export async function readBody(req: Request): Promise<ExplainRequest> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new ApiError("body_too_large", 413, "The message is too long. Shorten it and try again.");
  const raw = await req.text();
  if (bytes(raw) > MAX_BODY_BYTES) throw new ApiError("body_too_large", 413, "The message is too long. Shorten it and try again.");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError("invalid_body", 400, "The request was not valid JSON.");
  }
  const parsed = ExplainRequest.safeParse(json);
  if (!parsed.success) throw new ApiError("invalid_body", 400, "The request had missing or unknown fields.");
  // Defense in depth: the extension already scrubbed, and both functions are idempotent.
  return { ...parsed.data, text: scrubPii(scrubNames(parsed.data.text)) };
}

/** Markdown document sent to the model as data. The local verdict is context, not a question. */
export function buildDocument(r: ExplainRequest): string {
  return [
    "# Message under review (untrusted data, personal details already removed)",
    "",
    `Local verdict, decided by code and final: ${r.label}`,
    `Checks that fired: ${r.firedChecks.length ? r.firedChecks.join(", ") : "none"}`,
    "",
    "## Message text",
    "",
    r.text,
  ].join("\n");
}

/** Pull the JSON object out of the model text and validate it. A verdict field fails validation. */
export function parseModelOutput(text: string): AiResponse {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ApiError("bad_model_output", 502, "The AI reply was not in the expected form. Try again.");
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ApiError("bad_model_output", 502, "The AI reply was not in the expected form. Try again.");
  }
  const parsed = AiResponse.safeParse(json);
  if (!parsed.success) throw new ApiError("bad_model_output", 502, "The AI reply was not in the expected form. Try again.");
  return parsed.data;
}
