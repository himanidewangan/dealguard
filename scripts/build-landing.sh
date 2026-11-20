#!/bin/sh
# Build the extension zip, copy it next to the landing page, then build the landing page.
set -e
cd "$(dirname "$0")/.."
pnpm -F @dealguard/extension zip
ZIP=$(ls -t apps/extension/.output/*-chrome.zip | head -1)
cp "$ZIP" apps/landing/public/dealguard-extension.zip
pnpm -F @dealguard/landing build
echo "Landing page built in apps/landing/dist"
