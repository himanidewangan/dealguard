# Docker

| Goal | Command |
|---|---|
| Run the browser and unit tests (headless Chromium loads the extension) | `docker build --target test -t dealguard-test . && docker run --rm dealguard-test` |
| Serve the landing page and extension zip | `docker build -t dealguard . && docker run --rm -p 8080:80 dealguard` then open http://localhost:8080 |
| Get the built extension files on your disk | `docker build --target extension-out --output out .` (writes `out/dealguard-extension/` and `out/dealguard-extension.zip`) |

To use the extension in your own Chrome, take `out/dealguard-extension/` and load it at `chrome://extensions` with Developer mode and Load unpacked.

Production values (compiled into the extension, so treat them as public):

```
docker build -t dealguard \
  --build-arg WXT_PROXY_URL=https://dealguard-proxy.<subdomain>.workers.dev \
  --build-arg WXT_INSTALL_TOKEN=<token> \
  --build-arg WXT_DASHBOARD_EMAIL=<email> \
  --build-arg WXT_DASHBOARD_PASSWORD=<password> .
```

Never pass `ANTHROPIC_API_KEY` or `INSTALL_TOKEN_SECRET` to Docker. They belong in Cloudflare (`wrangler secret put`). The proxy is not part of the image.

The test target uses throwaway credentials and a local stand-in for the proxy, so it never calls Claude. It cannot test the real Worker or a live Claude reply.

The container runs headless. To click through the extension by hand, load it in Chrome on your machine as above.
