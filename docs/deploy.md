# Deploy DealGuard

Three pieces, three places:

| Piece | Where | Why there |
|---|---|---|
| Proxy (`apps/proxy`) | Cloudflare Workers | Holds the Anthropic key. GoDaddy shared hosting cannot run it. |
| Landing page (`apps/landing/dist`) | GoDaddy web hosting | Static files only. |
| Extension | Zip on the landing page | Users load it unpacked in Chrome. |

Order matters: proxy first, then the extension (it needs the proxy URL and token), then set the extension origin on the proxy, then the landing page (it ships the extension zip).

## 0. Accounts and tools

- Cloudflare account (free plan is enough): https://dash.cloudflare.com/sign-up
- Anthropic API key: https://console.anthropic.com
- GoDaddy web hosting plan (cPanel) for your domain
- Local: Node, pnpm, and `brew install lftp` only if you use the SFTP script
- Run `pnpm install` once in the repo root

## 1. Deploy the proxy

1. Log in: `pnpm -F @dealguard/proxy exec wrangler login` (opens the browser).
2. Make two random secrets. Use any generator, for example `openssl rand -hex 32` twice. Keep them in a password manager.
3. Set the secrets. Each command prompts for the value, so nothing lands in shell history or files:
   ```
   cd apps/proxy
   pnpm exec wrangler secret put ANTHROPIC_API_KEY
   pnpm exec wrangler secret put INSTALL_TOKEN_SECRET
   pnpm exec wrangler secret put ALLOWED_ORIGIN
   ```
   For `ALLOWED_ORIGIN` enter a placeholder now, `chrome-extension://placeholder`. You set the real value in step 4.
   Optional: `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`) and `DAILY_CAP` (default 500 requests per day per Worker instance).
4. Deploy: `pnpm deploy`. Wrangler prints the URL, for example `https://dealguard-proxy.<your-subdomain>.workers.dev`. This URL is your `WXT_PROXY_URL`.
5. Check it is alive. No token must give a clean refusal:
   ```
   curl -i -X POST https://dealguard-proxy.<your-subdomain>.workers.dev/explain
   ```
   Expect a 4xx JSON error, not a 5xx.

Rate limits and the daily cap live in memory of one Worker instance. That is fine for one instance. A restart resets them.

## 2. Mint the install token

```
cd apps/proxy
INSTALL_TOKEN_SECRET='<the same value you gave wrangler>' pnpm make-token
```

The output is your `WXT_INSTALL_TOKEN`. It only identifies the install. It is compiled into the extension, so treat it as revocable: to revoke, change `INSTALL_TOKEN_SECRET` and mint a new one.

## 3. Build the extension with production values

Create `apps/extension/.env.production` (gitignored):

```
WXT_PROXY_URL=https://dealguard-proxy.<your-subdomain>.workers.dev
WXT_INSTALL_TOKEN=<token from step 2>
WXT_DASHBOARD_EMAIL=<your dashboard email>
WXT_DASHBOARD_PASSWORD=<your dashboard password>
```

Then `pnpm build`. Load `apps/extension/.output/chrome-mv3` in Chrome: `chrome://extensions`, Developer mode, Load unpacked. Copy the **extension ID** shown on the card.

The dashboard sign-in is a local gate. The email and password are compiled into the build, so anyone who unpacks the extension can read them. It keeps casual users out and is not a security boundary.

The extension ID changes between machines for unpacked loads. For one stable ID across builds, add a `key` to the manifest (see Chrome docs, "manifest key") before you release.

## 4. Lock the proxy to the extension

```
cd apps/proxy
pnpm exec wrangler secret put ALLOWED_ORIGIN    # chrome-extension://<extension id>
pnpm deploy
```

Open the popup, paste a message, press Check message, then Explain with AI. You should see streamed text.

## 5. Build and upload the landing page

1. `pnpm build:landing` zips the extension, copies it to `apps/landing/public/dealguard-extension.zip`, and builds `apps/landing/dist`. Run step 3 first so the zip has production values.
2. Upload `apps/landing/dist` to GoDaddy, either way:

**A. cPanel File Manager (no tools)**
1. GoDaddy: My Products, Web Hosting, Manage, cPanel Admin.
2. Open File Manager, go to `public_html` (or the folder of your domain).
3. Back up anything already there, then delete the old files.
4. Upload the contents of `apps/landing/dist` (the files inside, not the folder): `index.html`, `assets/`, `dealguard-extension.zip`. Zip `dist` contents and use Upload then Extract if there are many files.

**B. SFTP script**
1. In cPanel, find the SFTP host and user (Hosting, Settings, SSH/SFTP). Enable SSH access if it is off.
2. `cp .env.deploy.example .env.deploy` and fill every value. Never commit this file.
3. `pnpm deploy:landing`. The script refuses to run with an empty value. It mirrors `dist` into `GODADDY_REMOTE_DIR` and **deletes remote files that are not in `dist`**. Point it at an empty folder or back up first.

3. Turn on HTTPS: cPanel, SSL/TLS Status, Run AutoSSL for the domain. Then check `https://<your-domain>`.
4. Verify: the page loads, the demo works with no network, **Download Chrome extension** downloads the zip, and the browser network tab shows no requests to other hosts.

## 6. Optional: your own API domain (`api.<your-domain>`)

The `workers.dev` URL is enough. Do not point a GoDaddy CNAME at `workers.dev`: Cloudflare will not serve it. A custom domain on a Worker needs the domain on Cloudflare:

1. Add the domain in Cloudflare (Websites, Add a site). Copy the two nameservers it gives you.
2. In GoDaddy: Domains, your domain, DNS, Nameservers, Change, "I'll use my own nameservers". Paste the two. This moves **all** DNS to Cloudflare, so first recreate your existing records (`A` for the hosting, `MX` for mail, `TXT`) in Cloudflare DNS or the website and email stop working.
3. Wait for Cloudflare to show the site as Active (minutes to hours).
4. Add to `apps/proxy/wrangler.toml`:
   ```
   routes = [{ pattern = "api.<your-domain>", custom_domain = true }]
   ```
5. `pnpm deploy`, then set `WXT_PROXY_URL=https://api.<your-domain>` and rebuild the extension.

## Environment variables

| Name | Where | Secret | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Worker, `wrangler secret` | yes | Claude calls |
| `INSTALL_TOKEN_SECRET` | Worker, `wrangler secret` | yes | Signs and checks install tokens |
| `ALLOWED_ORIGIN` | Worker, `wrangler secret` | no | `chrome-extension://<id>` for CORS |
| `ANTHROPIC_MODEL`, `DAILY_CAP` | Worker, optional | no | Model override, daily request cap |
| `WXT_PROXY_URL` | extension build | no | Proxy base URL |
| `WXT_INSTALL_TOKEN` | extension build | low | Identifies the install |
| `WXT_DASHBOARD_EMAIL`, `WXT_DASHBOARD_PASSWORD` | extension build | low | Local dashboard gate, not a security boundary |
| `GODADDY_SFTP_*`, `GODADDY_REMOTE_DIR`, `LANDING_DOMAIN` | `.env.deploy` | yes | Landing upload script |

Local proxy dev: copy `apps/proxy/.dev.vars.example` to `.dev.vars` (gitignored), then `pnpm -F @dealguard/proxy dev`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Explain says it could not reach the server | Wrong `WXT_PROXY_URL`, or offline | Check the URL, rebuild, reload the extension |
| 403 from the proxy | `ALLOWED_ORIGIN` does not match the extension ID | Step 4, then redeploy |
| 401 invalid token | Token minted with a different secret | Redo step 2 and rebuild |
| 429 | Per-minute or daily limit hit | Wait, or raise `DAILY_CAP` |
| "AI explanation is not set up" | Build had no proxy URL or token | Add `.env.production`, rebuild |
| Dashboard says login is not set up | Dashboard vars empty at build | Set both, rebuild |
| Popup blank | Old build loaded | Rebuild, press reload on `chrome://extensions` |
| Landing shows old page | Browser or host cache | Hard refresh, clear the host cache in cPanel |
