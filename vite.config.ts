import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";

export default defineConfig({
  plugins: [react()],
  // The app shows its version without a hand-maintained copy: the release bumps
  // package.json (checked against the other manifests by readme-contract.spec.ts).
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
