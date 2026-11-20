// Minimal Chrome DevTools Protocol driver. No dependencies: uses Node's built-in WebSocket and fetch.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CANDIDATES = [process.env.CHROME_BIN, "/usr/bin/chromium", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
const PORT = 9333;

export async function launch(extPath) {
  const bin = CANDIDATES.find((p) => existsSync(p));
  if (!bin) throw new Error("No Chrome or Chromium found. Set CHROME_BIN.");
  const dir = mkdtempSync(join(tmpdir(), "dealguard-profile-"));
  const args = ["--headless=new", `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, "--enable-unsafe-extension-debugging", "--remote-allow-origins=*", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-dev-shm-usage"];
  if (process.env.CHROME_NO_SANDBOX) args.push("--no-sandbox");
  const proc = spawn(bin, [...args, "about:blank"], { stdio: "ignore" });
  let wsUrl;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); }
  }
  if (!wsUrl) throw new Error("Chrome did not start");
  const sock = new WebSocket(wsUrl);
  await new Promise((r) => (sock.onopen = r));
  let id = 0;
  const pending = new Map();
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const p = m.id && pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); sock.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const ext = extPath ? await send("Extensions.loadUnpacked", { path: extPath }) : { id: undefined };
  async function page(url) {
    const { targetId } = await send("Target.createTarget", { url });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Runtime.enable", {}, sessionId);
    const ev = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)));
      return r.result.value;
    };
    await sleep(800);
    return { ev };
  }
  const close = () => { try { sock.close(); } catch {} proc.kill(); try { rmSync(dir, { recursive: true, force: true }); } catch {} };
  return { extId: ext.id, page, sleep, close };
}
