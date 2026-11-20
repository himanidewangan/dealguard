import { domainOf } from "@dealguard/core";
import type { CheckResult, IncomingMessage } from "@dealguard/core";
import { BRAND_RE, BRANDS, FREE_MAIL, PROVIDER_DOMAINS } from "./lists.ts";
import { lookalike, registrable } from "./lookalike.ts";
import { CHECK_IDS, NETWORK_CHECKS, WEIGHTS, type CheckId } from "./weights.ts";

type Outcome = Pick<CheckResult, "status" | "evidence">;
const fired = (evidence: string): Outcome => ({ status: "fired", evidence });
const clear = (evidence: string): Outcome => ({ status: "clear", evidence });
const unknown = (reason: string): Outcome => ({ status: "unknown", evidence: reason });

const PAY =
  /you (?:need|have|must|will need|will have) to pay|pay (?:a |an |the )?(?:small |one-time |refundable )?[a-z ]{0,20}(?:fee|deposit|charges?)|(?:registration|processing|security|verification|shipping|courier|kit|refundable|activation)\s+(?:fee|deposit|charges?|amount)|(?:send|transfer|deposit)\s+(?:rs\.?|inr|₹)\s?\d/i;
const CRED =
  /\b(?:share|send|give|enter|provide|confirm|tell|bhejo|batao)\b[^.\n]{0,40}\b(?:otp|password|pin|cvv|card (?:number|details)|net ?banking)\b|\b(?:otp|password|cvv)\b[^.\n]{0,30}\b(?:share|send|bhejo|batao)\b/gi;
const HINGLISH =
  /(?:paise|paisa|rupaye|fees?|amount|charges?)\s+(?:(?:rs\.?|₹)\s?\d[\d,]*\s+)?(?:abhi\s+)?(?:bhejo|bhej\s+do|bhejna|jama|transfer\s+karo|de\s+do|dena\s+hoga)|(?:bhejo|jama\s+karo)\s+(?:rs\.?|₹)\s?\d|(?:rs\.?|₹)\s?\d[\d,]*\s+(?:abhi\s+)?(?:bhejo|bhej\s+do|jama\s+karo|transfer\s+karo)/i;
const SIGNIN = /sign[- ]?in|log[- ]?in|verify your (?:account|identity)|connect your (?:instagram|account)|authori[sz]e/i;
const URGENCY =
  /\b(?:within|in)\s+(?:24|12|6|2|1)\s*(?:hours?|hrs?)\b|\burgent(?:ly)?\b|\bimmediately\b|\blast chance\b|\bonly \d+ (?:slots?|spots?) left\b|\bact now\b|\btoday only\b|\bhurry\b|\babhi\b|\bjaldi\b/i;

const CHEQUE = /\bcheque\b|\bcheck\b[^.\n]{0,20}\b(?:deposit|clear)|overpa(?:y|id|yment)|refund the (?:difference|balance|extra)|send back the (?:rest|balance|extra)/i;
const OFFPLATFORM = /telegram|t\.me\/|whatsapp|wa\.me|signal group/i;
const GREETING = /^(?:hi|hello|dear)\s+(?:creator|influencer|friend)\b/im;
const RATE_HIGH = 100000;

const ownedBy = (host: string, domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));

/** First match that is not preceded by a negation such as "do not". */
function unnegated(re: RegExp, text: string): string | undefined {
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 20), m.index);
    if (!/(?:do not|don't|dont|never|kabhi na)\s+$/i.test(before)) return m[0];
  }
  return undefined;
}

const CHECKS: Record<CheckId, (m: IncomingMessage) => Outcome> = {
  cheque: () => clear(""), lookalike: () => clear(""), offplatform: () => clear(""), rate_band: () => clear(""), greeting: () => clear(""), auth_headers: () => clear(""), domain_age: () => clear(""),
  pay_request: (m) => {
    const hit = m.text.match(PAY)?.[0];
    return hit ? fired(`Asks you to pay: "${hit}"`) : clear("No request for you to pay money.");
  },
  hinglish_payment: (m) => {
    const hit = m.text.match(HINGLISH)?.[0];
    return hit ? fired(`Asks you to pay (Hinglish): "${hit}"`) : clear("No Hinglish payment request.");
  },
  credentials: (m) => {
    const hit = unnegated(CRED, m.text);
    return hit ? fired(`Asks for a password, OTP or card details: "${hit}"`) : clear("No request for a password, OTP or card details.");
  },
  offdomain_signin: (m) => {
    const hosts = [...m.text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((x) => (x[1] ?? "").toLowerCase());
    if (hosts.length === 0) return unknown("No links in the message, so sign-in links could not be checked.");
    if (!SIGNIN.test(m.text)) return clear("No sign-in request.");
    const own = domainOf(m.from);
    // A sender's own domain is trusted for its own portal, unless that domain imitates a known brand.
    const imitation = own ? lookalike(own) : null;
    const ownTrusted = own !== undefined && !(imitation && "brand" in imitation);
    const bad = hosts.find((h) => !ownedBy(h, PROVIDER_DOMAINS) && !(ownTrusted && own && ownedBy(h, [own])));
    return bad ? fired(`Sign-in link points to ${bad}, not the provider's own domain.`) : clear("Sign-in links are on the provider's or sender's own domain.");
  },
  freemail_brand: (m) => {
    const d = domainOf(m.from);
    if (!d) return unknown("No From address, so the sender domain could not be checked.");
    const brand = `${m.subject ?? ""}\n${m.text}`.match(BRAND_RE)?.[0];
    if (FREE_MAIL.includes(d) && brand) return fired(`Mentions ${brand} but is sent from free mail (${d}).`);
    return clear(FREE_MAIL.includes(d) ? "Free mail sender, no big brand named." : `Sender domain ${d} is not free mail.`);
  },
  replyto_mismatch: (m) => {
    const from = domainOf(m.from);
    if (!from) return unknown("No From address, so Reply-To could not be compared.");
    const reply = domainOf(m.replyTo);
    if (!reply) return clear("No separate Reply-To address.");
    return reply !== from ? fired(`Replies go to ${reply}, not ${from}.`) : clear("Reply-To matches the sender domain.");
  },
  urgency: (m) => {
    const hit = m.text.match(URGENCY)?.[0];
    return hit ? fired(`Pressure to act fast: "${hit}"`) : clear("No pressure wording found.");
  },
};

function amounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?:₹|rs\.?\s?|inr\s?)\s?(\d[\d,]*(?:\.\d+)?)\s?(k|lakhs?|lacs?)?/gi)) {
    let v = parseFloat((m[1] ?? "").replace(/,/g, ""));
    if (m[2]) v *= /^k/i.test(m[2]) ? 1000 : 100000;
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

function linkHosts(text: string): string[] {
  return [...text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((x) => (x[1] ?? "").toLowerCase());
}

CHECKS.cheque = (m) => {
  const hit = m.text.match(CHEQUE)?.[0];
  return hit ? fired(`Overpayment or cheque wording: "${hit}"`) : clear("No overpayment or cheque wording.");
};
CHECKS.offplatform = (m) => {
  const hit = m.text.match(OFFPLATFORM)?.[0];
  return hit ? fired(`Moves the talk off this channel: "${hit}"`) : clear("Stays on the same channel.");
};
CHECKS.greeting = (m) => {
  const hit = m.text.match(GREETING)?.[0];
  return hit ? fired(`Generic greeting: "${hit}"`) : clear("Addressed by name or specific.");
};
CHECKS.rate_band = (m) => {
  const all = amounts(m.text);
  if (all.length === 0) return unknown("No amount stated, so it could not be checked.");
  const max = Math.max(...all);
  const shown = `₹${max.toLocaleString("en-IN")}`;
  return max >= RATE_HIGH ? fired(`${shown} is a very high offer for a first collaboration.`) : clear(`Highest amount is ${shown}.`);
};
CHECKS.lookalike = (m) => {
  const hosts = [...(domainOf(m.from) ? [{ host: domainOf(m.from) as string, where: "sender" }] : []), ...linkHosts(m.text).map((host) => ({ host, where: "link" }))];
  let official: string | undefined;
  for (const h of hosts) {
    const r = lookalike(h.host);
    if (r && "brand" in r) return fired(`${registrable(h.host)} (${h.where}): ${r.why}.`);
    if (r && "official" in r) official ??= r.official.name;
  }
  const named = BRANDS.find((b) => new RegExp(`\\b${b.name}\\b`, "i").test(`${m.subject ?? ""}\n${m.text}`));
  if (official && named) return clear(`Domain matches ${official}'s own.`);
  if (named) return unknown(`Names ${named.name} but the domain is not on the brand list.`);
  return unknown("No listed brand named, so it was not checked.");
};
CHECKS.auth_headers = (m) => {
  const line = m.text.match(/authentication-results:[^\n]*/i)?.[0];
  if (!line) return unknown("Pasted text has no headers, so this cannot run.");
  return /(spf|dkim|dmarc)=(fail|softfail|none)/i.test(line) ? fired(line.slice(0, 90)) : clear("Authentication headers pass.");
};
CHECKS.domain_age = () => unknown("Needs a registry lookup, which has not been run.");

export function runChecks(m: IncomingMessage): CheckResult[] {
  return CHECK_IDS.map((id) => {
    const w = WEIGHTS[id];
    const r = CHECKS[id](m);
    return { id, status: r.status, points: r.status === "fired" ? w.points : 0, hardStop: w.hardStop, evidence: r.evidence, source: NETWORK_CHECKS.includes(id) ? ("network_lookup" as const) : ("local_rule" as const) };
  });
}
