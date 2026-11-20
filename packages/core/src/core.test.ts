import { describe, expect, it } from "vitest";
import { domainOf, parseIncoming, scrubNames, scrubPii, AiResponse } from "./index.ts";

describe("scrubPii", () => {
  it("removes emails, phones, ids, cards and link paths but keeps domains", () => {
    const out = scrubPii(
      "Mail riya.sharma@gmail.com or call +91 98765 43210. PAN ABCDE1234F. Aadhaar 1234 5678 9012. " +
        "Card 4111 1111 1111 1111. UPI riya@oksbi. See https://bit.ly/abc?x=1",
    );
    expect(out).not.toMatch(/riya|98765|ABCDE|1234 5678|4111|oksbi|abc\?x/);
    expect(out).toContain("[email]@gmail.com");
    expect(out).toContain("[link:bit.ly]");
  });
});

describe("parseIncoming", () => {
  it("reads headers and keeps full text", () => {
    const m = parseIncoming("From: A <a@x.com>\nReply-To: b@y.com\nSubject: Hi\n\nBody");
    expect(m.from).toContain("a@x.com");
    expect(domainOf(m.replyTo)).toBe("y.com");
    expect(m.subject).toBe("Hi");
  });
  it("works without headers", () => {
    expect(parseIncoming("just text").from).toBeUndefined();
  });
});

describe("AiResponse", () => {
  it("rejects a verdict field", () => {
    const ok = { explanation: "e", saferReply: "r", signals: { asksForPayment: true, asksForCredentials: false, urgencyPressure: false, impersonatesBrand: false, movesOffPlatform: false } };
    expect(AiResponse.safeParse(ok).success).toBe(true);
    expect(AiResponse.safeParse({ ...ok, verdict: "Likely scam" }).success).toBe(false);
  });
});


describe("scrubNames", () => {
  it("removes display names in header lines but keeps the address", () => {
    expect(scrubNames("From: Priya Menon <priya@kaveritea.co.in>\nReply-To: Priya <p@x.com>")).toBe(
      "From: [name] <priya@kaveritea.co.in>\nReply-To: [name] <p@x.com>",
    );
  });
  it("removes greeting names but not generic words", () => {
    expect(scrubNames("Hi Aarav,\nHello Riya Sen!\nHi Creator,\nDear Team")).toBe("Hi [name],\nHello [name]!\nHi Creator,\nDear Team");
  });
  it("removes the name after a sign-off and keeps the role line", () => {
    expect(scrubNames("Thanks,\nPriya Menon\nBrand Partnerships, Kaveri Tea Co.")).toBe("Thanks,\n[name]\nBrand Partnerships, Kaveri Tea Co.");
    expect(scrubNames("Regards,\nAnanya, Marketing")).toBe("Regards,\n[name], Marketing");
  });
  it("removes self-introductions and keeps company names", () => {
    expect(scrubNames("I'm Priya from Kaveri Tea Co. My name is Rohan Das.")).toBe("I'm [name] from Kaveri Tea Co. My name is [name].");
  });
  it("removes @handles but not email domains", () => {
    expect(scrubNames("Collab for @yourhandle and @rahul_k")).toBe("Collab for [handle] and [handle]");
    expect(scrubPii(scrubNames("mail a@gmail.com"))).toBe("mail [email]@gmail.com");
    expect(scrubNames(scrubPii("mail a@gmail.com"))).toBe("mail [email]@gmail.com");
  });
  it("is idempotent", () => {
    const t = "From: Priya Menon <p@x.com>\nHi Aarav,\nI'm Priya. @me\nThanks,\nPriya";
    expect(scrubNames(scrubNames(t))).toBe(scrubNames(t));
  });
  it("handles 20,000 characters in under 20 ms", () => {
    const t = "Hi Aarav,\nI'm Priya from Kaveri. Thanks,\nPriya Menon\n".repeat(400).slice(0, 20000);
    const s = Date.now();
    scrubNames(t);
    expect(Date.now() - s).toBeLessThan(20);
  });
});
