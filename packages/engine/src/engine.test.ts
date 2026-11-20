import { describe, expect, it } from "vitest";
import { parseIncoming } from "@dealguard/core";
import { FIXTURES } from "../fixtures/index.ts";
import { runAnalysis } from "./index.ts";
import { score } from "./scorer.ts";

const run = (t: string) => runAnalysis(parseIncoming(t));

describe("fixtures", () => {
  for (const f of FIXTURES) {
    it(`${f.id}: ${f.note}`, () => {
      const r = run(f.text);
      if (f.kind === "genuine") expect(r.label).toBe("No red flags found");
      else expect(r.label).not.toBe("No red flags found");
    });
  }
  it("hard-stop scams are Likely scam", () => {
    for (const id of ["s1-fee", "s2-otp", "s3-bitly-signin", "s5-hinglish-fee", "s6-injection"]) {
      expect(run(FIXTURES.find((f) => f.id === id)!.text).label).toBe("Likely scam");
    }
  });
  it("sign-in link on a look-alike brand domain is a hard stop, even when it is the sender's own domain", () => {
    expect(run(FIXTURES.find((f) => f.id === "s8-design-sample-lookalike-signin")!.text).label).toBe("Likely scam");
    expect(run(FIXTURES.find((f) => f.id === "s8-design-sample-lookalike-signin")!.text).hardStop).toBe(true);
  });
  it("sign-in link on an unrelated agency domain stays clear", () => {
    const r = run(FIXTURES.find((f) => f.id === "g2-agency-hard-negative")!.text);
    expect(r.checks.find((c) => c.id === "offdomain_signin")?.status).toBe("clear");
  });
  it("soft scam is Suspicious", () => {
    expect(run(FIXTURES.find((f) => f.id === "s4-hinglish-soft")!.text).label).toBe("Suspicious");
  });
});

describe("checks", () => {
  it("returns unknown, not clear, when headers are missing", () => {
    const r = run("Hi, loved your reel. What are your rates?");
    const byId = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    expect(byId.freemail_brand).toBe("unknown");
    expect(byId.replyto_mismatch).toBe("unknown");
    expect(byId.offdomain_signin).toBe("unknown");
  });
  it("every check returns the full record", () => {
    for (const c of run("From: a@gmail.com\n\nhello").checks) {
      expect(Object.keys(c).sort()).toEqual(["evidence", "hardStop", "id", "points", "source", "status"]);
    }
  });
  it("a sign-in link on a lookalike host fires", () => {
    const r = run("From: a@x.com\n\nPlease log in: https://instagram.com.evil.xyz/login");
    expect(r.checks.find((c) => c.id === "offdomain_signin")?.status).toBe("fired");
  });
});

describe("scorer", () => {
  it("uses the fixed bands and labels", () => {
    const mk = (points: number) => [{ id: "x", status: "fired" as const, points, hardStop: false, evidence: "", source: "local_rule" as const }];
    expect(score(mk(60)).label).toBe("Likely scam");
    expect(score(mk(59)).label).toBe("Suspicious");
    expect(score(mk(30)).label).toBe("Suspicious");
    expect(score(mk(29)).label).toBe("No red flags found");
  });
});

describe("new checks", () => {
  const status = (text: string, id: string) => run(text).checks.find((c) => c.id === id)?.status;
  it("cheque fires on overpayment wording and is clear otherwise", () => {
    expect(status("We will send a cheque, please refund the difference.", "cheque")).toBe("fired");
    expect(status("We pay ₹10,000 by bank transfer after posting.", "cheque")).toBe("clear");
  });
  it("lookalike fires on a one-letter-off domain, is clear on the official one, unknown with no brand", () => {
    expect(status("From: a@myntrra.com\n\nMyntra offer", "lookalike")).toBe("fired");
    expect(status("From: a@myntra.com\n\nMyntra offer", "lookalike")).toBe("clear");
    expect(status("Hi, a plain note about a collab.", "lookalike")).toBe("unknown");
  });
  it("lookalike catches rn-for-m characters", () => {
    expect(status("From: a@arnazon.in\n\nAmazon offer", "lookalike")).toBe("fired");
  });
  it("offplatform fires on Telegram, clear otherwise", () => {
    expect(status("Chat on Telegram", "offplatform")).toBe("fired");
    expect(status("Reply here", "offplatform")).toBe("clear");
  });
  it("rate_band fires at 1 lakh, clear below, unknown with no amount", () => {
    expect(status("We offer ₹1,50,000", "rate_band")).toBe("fired");
    expect(status("We offer 1 lakh rs 2 lakh", "rate_band")).toBe("fired");
    expect(status("We offer ₹18,000", "rate_band")).toBe("clear");
    expect(status("We offer a barter", "rate_band")).toBe("unknown");
  });
  it("greeting fires on Hi Creator only", () => {
    expect(status("Hi Creator,\nOffer", "greeting")).toBe("fired");
    expect(status("Hi Aarav,\nOffer", "greeting")).toBe("clear");
  });
  it("auth_headers is unknown without headers, fired on dkim=fail, clear on pass", () => {
    expect(status("Hi", "auth_headers")).toBe("unknown");
    expect(status("Authentication-Results: mx; dkim=fail; spf=pass\n\nHi", "auth_headers")).toBe("fired");
    expect(status("Authentication-Results: mx; dkim=pass; spf=pass\n\nHi", "auth_headers")).toBe("clear");
  });
  it("domain_age is always unknown and sourced from a network lookup", () => {
    const c = run("Hi").checks.find((x) => x.id === "domain_age");
    expect(c?.status).toBe("unknown");
    expect(c?.source).toBe("network_lookup");
  });
  it("unknown checks add no points", () => {
    expect(run("Hi there").score).toBe(0);
  });
});
