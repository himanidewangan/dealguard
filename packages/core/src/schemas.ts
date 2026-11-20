import { z } from "zod";

export const LABELS = ["Likely scam", "Suspicious", "No red flags found"] as const;
export const Label = z.enum(LABELS);
export type Label = z.infer<typeof Label>;

export const IncomingMessage = z.object({
  source: z.literal("paste"),
  text: z.string().min(1).max(20000),
  from: z.string().max(320).optional(),
  replyTo: z.string().max(320).optional(),
  subject: z.string().max(500).optional(),
});
export type IncomingMessage = z.infer<typeof IncomingMessage>;

export const CheckResult = z.object({
  id: z.string(),
  status: z.enum(["fired", "clear", "unknown"]),
  points: z.number().int().min(0),
  hardStop: z.boolean(),
  evidence: z.string(),
  source: z.enum(["local_rule", "network_lookup"]),
});
export type CheckResult = z.infer<typeof CheckResult>;

export const AnalysisResult = z.object({
  label: Label,
  score: z.number().int().min(0).max(100),
  hardStop: z.boolean(),
  checks: z.array(CheckResult),
});
export type AnalysisResult = z.infer<typeof AnalysisResult>;

/** Body the extension sends to the proxy. Already scrubbed of PII. The verdict is input, never output. */
export const ExplainRequest = z.strictObject({
  text: z.string().min(1).max(6000),
  label: Label,
  firedChecks: z.array(z.string().max(40)).max(20),
});
export type ExplainRequest = z.infer<typeof ExplainRequest>;

/** Structure the model must return. There is no verdict field on purpose. */
export const AiResponse = z.strictObject({
  explanation: z.string().max(600),
  signals: z.strictObject({
    asksForPayment: z.boolean(),
    asksForCredentials: z.boolean(),
    urgencyPressure: z.boolean(),
    impersonatesBrand: z.boolean(),
    movesOffPlatform: z.boolean(),
  }),
  saferReply: z.string().max(600),
});
export type AiResponse = z.infer<typeof AiResponse>;
