// Every tunable lives here. Model IDs live only in this file.
export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const MAX_OUTPUT_TOKENS = 700;
export const UPSTREAM_TIMEOUT_MS = 30_000;
export const MAX_BODY_BYTES = 16_000;
export const RATE_LIMIT = { perMinutePerToken: 10, perMinutePerIp: 20 };
export const DEFAULT_DAILY_CAP = 500;

export interface Env {
  ANTHROPIC_API_KEY: string;
  INSTALL_TOKEN_SECRET: string;
  /** Exact extension origin, e.g. chrome-extension://abcdef. Empty means every request is refused. */
  ALLOWED_ORIGIN: string;
  ANTHROPIC_MODEL?: string;
  DAILY_CAP?: string;
}
