import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "DealGuard",
    description: "Check a brand-deal message for scam signs. Runs on your device.",
    // No permissions and no host permissions. The popup calls the proxy over CORS.
    permissions: [],
    action: { default_title: "DealGuard" },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});
