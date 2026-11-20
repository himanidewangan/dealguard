export const CHECK_IDS = [
  "pay_request",
  "credentials",
  "offdomain_signin",
  "hinglish_payment",
  "freemail_brand",
  "replyto_mismatch",
  "urgency",
  "cheque",
  "lookalike",
  "offplatform",
  "rate_band",
  "greeting",
  "auth_headers",
  "domain_age",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

/** Points a fired check adds, and whether firing it is a hard stop. */
export const WEIGHTS: Record<CheckId, { points: number; hardStop: boolean }> = {
  pay_request: { points: 60, hardStop: true },
  credentials: { points: 60, hardStop: true },
  offdomain_signin: { points: 60, hardStop: true },
  hinglish_payment: { points: 60, hardStop: true },
  freemail_brand: { points: 25, hardStop: false },
  replyto_mismatch: { points: 20, hardStop: false },
  urgency: { points: 10, hardStop: false },
  cheque: { points: 40, hardStop: false },
  lookalike: { points: 30, hardStop: false },
  offplatform: { points: 15, hardStop: false },
  rate_band: { points: 15, hardStop: false },
  greeting: { points: 10, hardStop: false },
  auth_headers: { points: 20, hardStop: false },
  domain_age: { points: 25, hardStop: false },
};

/** Checks that need the network. They stay `unknown` until a lookup feature is turned on. */
export const NETWORK_CHECKS: readonly CheckId[] = ["domain_age"];

/** Name shown for each check in the UI. */
export const CHECK_NAMES: Record<CheckId, string> = {
  pay_request: "Asks you to pay first",
  credentials: "Asks for password, OTP or card details",
  offdomain_signin: "Sign-in link not on the provider's own site",
  hinglish_payment: "Asks you to pay first (Hinglish)",
  freemail_brand: "Free-mail sender posing as a company",
  replyto_mismatch: "Reply-To goes to a different domain",
  urgency: "Pressure to act now",
  cheque: "Overpayment or fake cheque",
  lookalike: "Look-alike brand domain",
  offplatform: "Pushes you to Telegram or WhatsApp",
  rate_band: "Unusually high amount offered",
  greeting: "Generic greeting, vague offer",
  auth_headers: "SPF, DKIM or DMARC fails",
  domain_age: "Sender domain registered under 30 days",
};

export const BANDS = { likelyScam: 60, suspicious: 30 } as const;
