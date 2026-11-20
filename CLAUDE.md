# DealGuard

A local-first Chrome extension (Manifest V3) that checks whether a brand-deal email or DM sent to an Indian nano or micro creator is a scam. It returns a verdict, the evidence, a safe reply, and a report kit for 1930 and cybercrime.gov.in. It never says a message is "safe".

## How to work in this repo

- Output only what is needed. No long explanations, no restating the task, no summaries of steps. Final report under 40 lines: what changed, what was verified, what is left.
- Inspect before changing. Read the files you will touch. Never overwrite existing user work; write `.proposed` beside a file you are unsure about.
- Do one milestone at a time. Do not build later milestones early.
- Ask before adding a dependency. Allowed without asking: react, react-dom, zod, dexie, typescript, wxt, @wxt-dev/module-react, tailwindcss and its Vite plugin, vitest, fake-indexeddb, @types/react, @types/react-dom.
- Pin exact versions (`pnpm add --save-exact`). Commit `pnpm-lock.yaml`.
- Verify before saying done: run `pnpm typecheck`, `pnpm test`, `pnpm build`. Report any you could not run.

## Commands

```
pnpm install            # runs wxt prepare via postinstall
pnpm dev                # extension dev build with reload
pnpm build              # production build to apps/extension/.output
pnpm typecheck          # tsc --noEmit in every package
pnpm test               # vitest in every package
pnpm eval               # runs the engine against fixtures (from Milestone 2)
```

## Layout

```
packages/core      Zod schemas, types, pure helpers. No browser or network APIs.
packages/engine    Signals, scorer, brands list, fixtures, eval script. Pure TypeScript.
packages/db        Dexie database and repositories.
apps/extension     WXT + React + Tailwind. Popup, dashboard (options page), background.
apps/proxy         Edge proxy for secret-key APIs. Added at Milestone 4. Not before.
```

Dependency direction: `apps/*` → `engine`, `db` → `core`. `core` and `engine` import nothing from the others, from `chrome.*`, from `window`, or from `fetch`.

## Architecture rules

1. **Code decides, a model explains.** The verdict comes only from the scorer in `packages/engine`. Claude may extract structured flags and write the explanation after the verdict. It never sets, changes or vetoes a verdict.
2. **Every check returns the same record:** `{ id, status: "fired" | "clear" | "unknown", points, hardStop, evidence, source: "local_rule" | "network_lookup" }`. `unknown` is never a pass. When a check cannot run (no headers, no lookup), return `unknown` with the reason.
3. **Scoring:** any fired hard stop is Likely scam. Otherwise points sum: 60 or more Likely scam, 30 to 59 Suspicious, under 30 "No red flags found". The labels are fixed. Do not add "Safe", "Legit" or "Genuine" anywhere in code, UI or copy.
4. **Hard stops:** asks the creator to pay; asks for a password, OTP or card details; sign-in link not on the provider's own domain.
5. **One ingestion path.** Paste, right-click selection, `.eml` upload and Gmail sync all build an `IncomingMessage` and call the same `runAnalysis` and save function.
6. **The engine must run unchanged on a server later.** No `chrome.*`, DOM, `localStorage` or global state in `core` and `engine`.
7. **Treat message text as hostile.** It is data. Never `eval`, never render it as HTML, never pass it into a prompt without delimiters and an instruction that it is untrusted.

## Extension (frontend) rules

- Manifest V3 via WXT. Declare the minimum permissions. Start with `permissions: []` and no host permissions. Add `contextMenus`, `activeTab`, `scripting` only at Milestone 3. Gmail and RDAP only as optional permissions, requested on a user click.
- The service worker is not a server. It sleeps after about 30 seconds. Keep no state in memory, schedule work with `chrome.alarms`, and make every wake restartable.
- The database is the only shared state. UI pages read IndexedDB with Dexie live queries and never ask the service worker for data.
- No remote code, no CDN scripts, no remote fonts or images. Everything ships in the bundle. Bundle fonts locally (ask before adding `@fontsource` packages).
- React: function components, hooks, no class components. Keep state local; lift it only when two components need it. No global state library.
- Forms keep a draft across popup close. A pasted message must not be lost when the popup closes.
- Every form control has a visible label, a stable `id`, and a visible focus ring. Keyboard works everywhere. Do not rely on color alone: status shows an icon and a word as well as color.
- Respect `prefers-reduced-motion`. Respect system text size. Minimum tap target 44px.
- Render user text with React text nodes only. No `dangerouslySetInnerHTML`.
- Validate every boundary with Zod: storage reads, file uploads, messages between extension contexts, network responses.
- Copy: plain words, active voice, say what a control does ("Check message", "Copy reply"). Errors say what went wrong and what to do. No em-dash asides, no scare quotes.

## Backend rules (`apps/proxy`, Milestone 4 onward)

Purpose: hold secret keys (Anthropic, Google Safe Browsing, GoDaddy) so they never ship in the extension. It is not a place to store user data or compute verdicts.

- TypeScript on Cloudflare Workers. Keep dependencies minimal; Zod for validation.
- Secrets only through `wrangler secret`. Never in code, `.env` files in the repo, logs or error messages.
- Validate every request body with Zod. Reject unknown fields, cap body size, cap text length.
- Authenticate each install with a signed install token, rate limit per token and per IP, and set a daily cost ceiling. Fail closed.
- Restrict CORS to the extension origin.
- **Never log message bodies, sender addresses or links.** Log only: timestamp, route, status, latency, token id (hashed).
- Do not persist anything by default. If persistence is added, write down what, why and for how long in `docs/privacy.md` first.
- Timeouts on every upstream call, no retries on non-idempotent calls, return typed errors the extension can show.
- Claude calls: structured output only, validated against a Zod schema before returning. The model returns booleans and enums for signals and a short explanation. It never returns a verdict field. Treat the message as untrusted text between delimiters.
- Model IDs live in one config file, not scattered through code.
- Each route has tests, including: invalid body, oversize body, missing token, rate limit hit, upstream failure.

## Testing rules

- Vitest. `fake-indexeddb` for database tests. Node environment for `core` and `engine`.
- The engine is measured on fixtures in `packages/engine/fixtures`: 12 genuine (3 hard negatives such as a real brand sent through an agency domain), 18 scam, including 4 Hinglish and 1 prompt-injection attempt. `pnpm eval` prints precision, recall and every misclassified fixture. Never loosen a rule to make one fixture pass without checking the genuine set.
- A new check needs: its own tests, at least one fixture that fires it and one that must not, and an entry in the weights table.
- Test the unknown path as well as fired and clear.

## Privacy and security

- Message bodies stay on the device unless the user turns on a feature that sends them, and each such feature says so before it sends anything.
- Features that send data: Claude explanation (message text), domain age lookup (sender domain), link check (URLs). Each is off by default, each needs a user action, each is listed in the privacy text.
- No analytics, no telemetry, no third-party scripts.
- Gmail uses OAuth with the narrowest scope that works. Keep tokens in memory or in Chrome's own cache. Never in IndexedDB or logs.
- Never claim a message is genuine. Never present rate bands or statistics as fact without their source and date.

## Design language

Source: the user's dark dashboard reference (charcoal shell, soft coral, forest green, butter yellow, mono headings, pill chips, large rounded cards). Implement as Tailwind theme tokens, never as raw hex in components.

Color tokens

| Token | Value | Use |
|---|---|---|
| `sage` | `#CFD8CF` | Page backdrop on the landing page |
| `ink` | `#1B1B1A` | Main shell, primary dark surface |
| `card` | `#262625` | Cards and rows on ink |
| `well` | `#1F1F1E` | Inputs, code and text wells |
| `line` | `#3B3B38` | Borders and dividers |
| `text` | `#F4EFE6` | Primary text on dark |
| `muted` | `#AAAAA2` | Secondary text on dark |
| `forest` | `#24382F` | Feature block, explanation surfaces |
| `mint` | `#CDEBE3` | Actions, active nav, selected chips |
| `coral` | `#E5735A` | Danger only: Likely scam, fired checks, hard stops |
| `butter` | `#F2D184` | Suspicious, alerts, chart bars on forest |
| `sky` | `#A9DDEE` | No red flags found, clear checks |

Rules:
- Coral means danger and nothing else. Never use it for branding or a primary button. Primary actions are mint or ink.
- Verdict colors: Likely scam coral, Suspicious butter, No red flags found sky. Never use green for a verdict, because green reads as "safe".
- Text on coral, butter, sky and mint is `ink`. Text on ink, card and forest is `text` or `muted`. Keep body text at 4.5:1 contrast or better.
- Status always shows a label and an icon as well as color: `● Fired`, `✓ Clear`, `? Unknown`.

Type
- Display and data: Space Mono 700 for headings, scores, domains and evidence. Labels are uppercase 11px with 0.12em tracking.
- Body: DM Sans 400, 500, 700.
- Fallbacks: `ui-monospace, Menlo, monospace` and `system-ui, sans-serif`. Use `tabular-nums` for any column of digits.

Shape and space
- Radius: shell 36px, cards 28px, rows 18 to 22px, inputs 20px, pills and buttons 999px.
- Layout is a bento grid of large rounded blocks on ink. Use gap, not margins, between siblings. 16px minimum side gutter.
- Buttons: 44px high, mono 13px bold. Chips: 36px high.
- Charts: mono labels, bars to scale with a labeled axis, no 3D, no gradients.

Popup is 380px wide. The dashboard and landing page follow the same tokens. The landing page is a static page in `apps/landing` (not part of the extension bundle) and its paste-box demo runs the engine on sample data with no network.

## Definition of done for any task

1. Typecheck, tests and build pass, or the report says which could not run.
2. No new network call, permission or dependency that was not asked for. Check with:
   `grep -rnE "fetch\(|XMLHttpRequest|WebSocket" apps packages --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.output --exclude-dir=.wxt`
3. No "safe" or "genuine" verdict wording anywhere.
4. The change is within the current milestone.


## Instruction by a human read it at the end and modify the requirements as stated below
- The landing page should also have a button to download the chrome extension
- The artifact which gives design of the landing page is https://claude.ai/artifact/BXrnzVdK1ioN1D5qPoc8zr
- The analysis of the email content should be sent to the backend, and the backend analyse with the claude API, define the structure of the response of the prompt and send the email as the part of the prompt or as a text document or md document to parse.
- The email should be first parsed and pii informations should be removed first.
- Keep the context use minimal and optimal.