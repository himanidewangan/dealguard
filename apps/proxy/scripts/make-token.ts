// Usage: INSTALL_TOKEN_SECRET=... node scripts/make-token.ts [install-id]
import { signToken } from "../src/token.ts";

const secret = process.env.INSTALL_TOKEN_SECRET;
if (!secret) {
  console.log("Set INSTALL_TOKEN_SECRET first.");
  process.exit(1);
}
console.log(await signToken(secret, process.argv[2] ?? "dealguard-web-1"));
