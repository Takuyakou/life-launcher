import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// P97-05: flat config. The rule range is the same as the old .eslintrc.cjs:
// ESLint recommended, typescript-eslint recommended, react-hooks rules-of-hooks and
// exhaustive-deps, and react-refresh only-export-components. React Compiler rules that
// newer react-hooks releases put in their recommended preset are intentionally not used.
export default tseslint.config(
  { ignores: ["dist", "src-tauri/target", ".local-evaluation", "**/.*"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2020 },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
