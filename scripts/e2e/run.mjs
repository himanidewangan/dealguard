// Browser tests for the built extension and landing page. Run after building with the test env below.
//   WXT_PROXY_URL=http://127.0.0.1:8799 WXT_INSTALL_TOKEN=tok WXT_DASHBOARD_EMAIL=test@dealguard.test WXT_DASHBOARD_PASSWORD=test-pass pnpm build
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";

const root = resolve(fileURLToPath(import.meta.url), "../../..");
const EXT = join(root, "apps/extension/.output/chrome-mv3");
const DIST = join(root, "apps/landing/dist");
const EMAIL = "test@dealguard.test";
const PASS = "test-pass";
const results = [];
const ok = (name, cond, extra = "") => results.push({ name, pass: Boolean(cond), extra });

// Stand-in for the proxy: records the request body and streams a fixed answer.
let lastBody = "";
let lastToken = "";
const FINAL = { explanation: "It asks you to pay a fee before any work.", signals: { asksForPayment: true, asksForCredentials: false, urgencyPressure: true, impersonatesBrand: true, movesOffPlatform: true }, saferReply: "I do not pay fees. Send the brief from your official email." };
const fake = http.createServer((req, res) => {
  const cors = { "access-control-allow-origin": req.headers.origin ?? "*", "access-control-allow-headers": "content-type,x-install-token", "access-control-allow-methods": "POST" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    lastBody = b; lastToken = String(req.headers["x-install-token"] ?? "");
    res.writeHead(200, { ...cors, "content-type": "text/event-stream" });
    const raw = JSON.stringify(FINAL);
    res.write(`event: delta\ndata: ${JSON.stringify({ text: raw.slice(0, 30) })}\n\n`);
    setTimeout(() => { res.write(`event: delta\ndata: ${JSON.stringify({ text: raw.slice(30) })}\n\n`); res.write(`event: done\ndata: ${raw}\n\n`); res.end(); }, 200);
  });
}).listen(8799, "127.0.0.1");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".zip": "application/zip" };
const site = http.createServer((req, res) => {
  const p = join(DIST, req.url === "/" ? "index.html" : decodeURIComponent((req.url ?? "").split("?")[0]));
  if (!p.startsWith(DIST) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
  res.end(readFileSync(p));
}).listen(8800, "127.0.0.1");

const setText = (id, v, proto = "HTMLTextAreaElement") => `(() => { const e = document.getElementById('${id}'); Object.getOwnPropertyDescriptor(${proto}.prototype, 'value').set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const body = async (pg) => (await pg.ev("document.body.innerText")).toLowerCase();

const b = await launch(EXT);
try {
  const FEE = "From: Priya Menon <priya@evil-nike.in>\nSubject: Collab\n\nHi Aarav,\nI'm Priya. Please pay a refundable registration fee of ₹4,999 via UPI today, call 9876543210, see https://evil-nike.in/login?u=aarav or @aarav_k. Continue on Telegram: t.me/x\nThanks,\nPriya Menon";
  const popup = await b.page(`chrome-extension://${b.extId}/popup.html`);
  await popup.ev(setText("message", FEE));
  await popup.ev("document.getElementById('check').click()");
  await b.sleep(800);
  let t = await body(popup);
  ok("popup: verdict Likely scam with hard stop", t.includes("likely scam") && t.includes("hard stop fired"));
  ok("popup: Safe reply and Report kit panels", t.includes("safe reply") && t.includes("any fee or deposit") && t.includes("report kit") && t.includes("link domains"));
  ok("popup: draft kept", (await popup.ev("localStorage.getItem('dealguard:draft')")).includes("registration fee"));
  ok("popup: buttons are at least 44px", (await popup.ev("[...document.querySelectorAll('button')].filter(x => x.offsetHeight < 44).length")) === 0);
  ok("popup: no legit or genuine wording", !/\b(legit|genuine)\b/.test(t));

  await popup.ev("document.getElementById('explain').click()");
  await b.sleep(1500);
  t = await body(popup);
  ok("explain: streamed answer and Copy reply shown", t.includes("it asks you to pay a fee before any work.") && t.includes("copy reply"));
  ok("explain: install token sent", lastToken === "tok");
  const leaks = ["Priya Menon", "Aarav", "aarav_k", "9876543210", "priya@evil", "login?u="].filter((x) => lastBody.includes(x));
  ok("explain: names, phone, handle, email and link path removed before sending", leaks.length === 0, leaks.join(","));

  const dash = await b.page(`chrome-extension://${b.extId}/options.html`);
  const login = (e, p) => dash.ev(`(() => { ${setText("email", e, "HTMLInputElement")}; ${setText("password", p, "HTMLInputElement")}; document.getElementById('login').click(); })()`);
  t = await body(dash);
  ok("dashboard: login shown first", t.includes("sign in") && !t.includes("verdicts by count"));
  await login(EMAIL, "wrong"); await b.sleep(300);
  t = await body(dash);
  ok("dashboard: wrong password rejected", t.includes("not right") && !t.includes("verdicts by count"));
  await login(EMAIL, PASS); await b.sleep(900);
  t = await body(dash);
  ok("dashboard: correct login opens it", t.includes("verdicts by count") && t.includes("most fired checks"));
  ok("dashboard: history has the popup check", t.includes("likely scam") && t.includes("evil-nike.in"));
  await popup.ev(setText("message", "Hi Aarav, one reel for ₹10,000 paid in 15 days against invoice."));
  await popup.ev("document.getElementById('check').click()");
  await b.sleep(900);
  ok("dashboard: updates live to 2 checks", /checks\s*\n?\s*2/.test(await body(dash)));
  await dash.ev("document.querySelectorAll('button[aria-expanded]')[0].click()"); await b.sleep(300);
  t = await body(dash);
  ok("dashboard: detail shows safe reply and delete", t.includes("safe reply") && t.includes("delete this check"));
  await dash.ev("[...document.querySelectorAll('button')].find(x => x.textContent.includes('Delete this check')).click()"); await b.sleep(500);
  ok("dashboard: delete removes one row", (await dash.ev("document.querySelectorAll('button[aria-expanded]').length")) === 1);
  await dash.ev("document.getElementById('clear').click()"); await b.sleep(200);
  await dash.ev("document.getElementById('clear-confirm').click()"); await b.sleep(500);
  ok("dashboard: clear history empties it", (await body(dash)).includes("no checks yet"));
  await dash.ev("document.getElementById('logout').click()"); await b.sleep(300);
  ok("dashboard: sign out returns to login", !(await body(dash)).includes("verdicts by count") && (await body(dash)).includes("sign in"));

  if (existsSync(join(DIST, "index.html"))) {
    const land = await b.page("http://127.0.0.1:8800/");
    const verdict = () => land.ev("document.querySelector('#result .verdict h3')?.textContent");
    const first = await verdict();
    await land.ev("document.getElementById('s2').click()"); const second = await verdict();
    await land.ev("document.getElementById('s3').click()"); const third = await verdict();
    ok("landing: samples give Likely scam, Likely scam, No red flags found", first === "Likely scam" && second === "Likely scam" && third === "No red flags found", [first, second, third].join(" / "));
    ok("landing: every request goes to the page's own host", (await land.ev("[...new Set(performance.getEntriesByType('resource').map(r => new URL(r.name).host))].join(',')")) === "127.0.0.1:8800");
    ok("landing: download links point at the zip and it is served", (await land.ev("[...document.querySelectorAll('a[download]')].every(a => a.getAttribute('href') === 'dealguard-extension.zip')")) && (await land.ev("fetch('/dealguard-extension.zip').then(r => r.status)")) === 200);
  } else {
    ok("landing: built (run pnpm build:landing first)", false);
  }
} catch (e) {
  ok("run completed without an error", false, String(e.message).slice(0, 300));
}
b.close(); fake.close(); site.close();
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.extra ? `  (${r.extra})` : ""}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
