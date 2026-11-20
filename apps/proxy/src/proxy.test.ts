import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./config.ts";
import type { Deps } from "./ai.ts";
import { handle, resetState } from "./index.ts";
import { signToken } from "./token.ts";

const ORIGIN = "chrome-extension://abc";
const env: Env = { ANTHROPIC_API_KEY: "test-key", INSTALL_TOKEN_SECRET: "test-secret", ALLOWED_ORIGIN: ORIGIN };
const GOOD = JSON.stringify({
  explanation: "It asks you to pay a fee.",
  signals: { asksForPayment: true, asksForCredentials: false, urgencyPressure: false, impersonatesBrand: false, movesOffPlatform: false },
  saferReply: "I do not pay fees. Send the brief from your official email.",
});
const body = { text: "Pay the fee [email]@gmail.com", label: "Likely scam", firedChecks: ["pay_request"] };

function sse(text: string): Response {
  const events = [text.slice(0, 20), text.slice(20)].map((t) => `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: t } })}\n\n`);
  return new Response(events.join(""), { status: 200, headers: { "content-type": "text/event-stream" } });
}
const okDeps = (): Deps => ({ fetch: async () => sse(GOOD), now: () => Date.now() });

async function call(payload: BodyInit, o: { token?: string | null; origin?: string } = {}, deps = okDeps()) {
  const headers: Record<string, string> = { origin: o.origin ?? ORIGIN, "content-type": "application/json" };
  const token = o.token === undefined ? await signToken(env.INSTALL_TOKEN_SECRET, "install-1") : o.token;
  if (token) headers["x-install-token"] = token;
  return handle(new Request("https://api.test/explain", { method: "POST", headers, body: payload }), env, deps);
}

beforeEach(() => {
  resetState();
  vi.restoreAllMocks();
});

describe("POST /explain", () => {
  it("streams deltas then a validated done event", async () => {
    const res = await call(JSON.stringify(body));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: delta");
    const done = text.split("\n\n").find((b) => b.startsWith("event: done"))!;
    const parsed = JSON.parse(done.split("data: ")[1]!);
    expect(parsed.explanation).toContain("pay a fee");
    expect(parsed).not.toHaveProperty("verdict");
  });
  it("rejects an invalid body", async () => {
    const res = await call(JSON.stringify({ ...body, extra: 1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_body");
  });
  it("rejects an oversize body", async () => {
    const res = await call(JSON.stringify({ ...body, text: "x".repeat(20000) }));
    expect(res.status).toBe(413);
  });
  it("rejects a missing token", async () => {
    expect((await call(JSON.stringify(body), { token: null })).status).toBe(401);
  });
  it("rejects a forged token", async () => {
    expect((await call(JSON.stringify(body), { token: "install-1.AAAA" })).status).toBe(401);
  });
  it("rejects a foreign origin", async () => {
    expect((await call(JSON.stringify(body), { origin: "https://evil.example" })).status).toBe(403);
  });
  it("rate limits per token", async () => {
    for (let i = 0; i < 10; i++) await (await call(JSON.stringify(body))).text();
    const res = await call(JSON.stringify(body));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("rate_limited");
  });
  it("removes names, handles and links again before the upstream call", async () => {
    let sent = "";
    const deps: Deps = { fetch: async (_u, init) => { sent = String(init?.body); return sse(GOOD); }, now: () => Date.now() };
    const raw = { ...body, text: "From: Priya Menon <priya@x.com>\nHi Aarav,\nI'm Priya. See https://evil.test/a?u=aarav and @aarav_k\nThanks,\nPriya Menon" };
    await (await call(JSON.stringify(raw), {}, deps)).text();
    for (const leak of ["Priya Menon", "Aarav", "aarav_k", "priya@x.com", "/a?u="]) expect(sent).not.toContain(leak);
  });
  it("returns a typed error when the upstream fails", async () => {
    const res = await call(JSON.stringify(body), {}, { fetch: async () => new Response("boom", { status: 500 }), now: () => Date.now() });
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("upstream_error");
  });
  it("rejects model output that carries a verdict", async () => {
    const bad = JSON.stringify({ ...JSON.parse(GOOD), verdict: "safe" });
    const res = await call(JSON.stringify(body), {}, { fetch: async () => sse(bad), now: () => Date.now() });
    expect(await res.text()).toContain("event: error");
  });
  it("never logs message text", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await (await call(JSON.stringify({ ...body, text: "SECRETMARKER pay the fee" }))).text();
    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain('"route":"/explain"');
    expect(logged).not.toContain("SECRETMARKER");
    expect(logged).not.toContain("install-1");
  });
});
