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
    // Transform the entry and the two lazily loaded windows when the server starts. Without this,
    // the first Visual QA test that opens the dictionary or the viewer pays for the transform and
    // can miss its 5 s expect timeout on a busy machine.
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/components/DictionaryWindow.tsx",
        "./src/components/InstructionViewer.tsx",
      ],
    },
  },
});
