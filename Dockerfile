# DealGuard. Build targets:
#   runtime        (default) nginx serving the landing page and the extension zip on port 80
#   test           headless Chromium loads the built extension and runs the browser tests
#   extension-out  only the built extension files, for `docker build --target extension-out --output out .`
#
# The WXT_* values are compiled into the extension. They are public once the extension ships,
# so do not pass anything here that you would not put in a Chrome extension. The proxy secrets
# (ANTHROPIC_API_KEY and friends) never go in this image; they live in Cloudflare.

FROM node:26-bookworm-slim AS base
RUN npm install -g pnpm@12.21.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# ---- production build of the extension and landing page ----
FROM base AS build
ARG WXT_PROXY_URL=""
ARG WXT_INSTALL_TOKEN=""
ARG WXT_DASHBOARD_EMAIL=""
ARG WXT_DASHBOARD_PASSWORD=""
ENV WXT_PROXY_URL=$WXT_PROXY_URL WXT_INSTALL_TOKEN=$WXT_INSTALL_TOKEN WXT_DASHBOARD_EMAIL=$WXT_DASHBOARD_EMAIL WXT_DASHBOARD_PASSWORD=$WXT_DASHBOARD_PASSWORD
RUN sh scripts/build-landing.sh

# ---- browser tests: throwaway credentials and a local stand-in for the proxy ----
FROM base AS test
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation \
 && rm -rf /var/lib/apt/lists/*
ENV CHROME_BIN=/usr/bin/chromium CHROME_NO_SANDBOX=1
RUN sh scripts/build-landing.sh
# Build the extension last: build-landing.sh rebuilds it without these values.
RUN WXT_PROXY_URL=http://127.0.0.1:8799 WXT_INSTALL_TOKEN=tok WXT_DASHBOARD_EMAIL=test@dealguard.test WXT_DASHBOARD_PASSWORD=test-pass \
    pnpm -F @dealguard/extension build
CMD ["sh", "-c", "pnpm typecheck && pnpm test && pnpm eval && pnpm e2e"]

# ---- just the extension files ----
FROM scratch AS extension-out
COPY --from=build /app/apps/extension/.output/chrome-mv3 /dealguard-extension
COPY --from=build /app/apps/landing/dist/dealguard-extension.zip /dealguard-extension.zip

# ---- default: serve the landing page ----
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/landing/dist /usr/share/nginx/html
COPY --from=build /app/apps/extension/.output/chrome-mv3 /opt/dealguard-extension
EXPOSE 80
