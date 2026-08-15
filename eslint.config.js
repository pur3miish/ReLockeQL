import js from "@eslint/js";
import globals from "globals";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "test/snapshots/**"]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: [
      "src/**/*.ts",
      "test/**/*.ts",
      "test/**/*.js",
      "scripts/**/*.mjs",
      "examples/**/*.js"
    ],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.mocha
      }
    },

    plugins: {
      "simple-import-sort": simpleImportSort
    },

    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
);
