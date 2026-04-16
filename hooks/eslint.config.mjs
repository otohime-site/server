// @ts-check

import eslint from "@eslint/js"
import prettier from "eslint-config-prettier/flat"
import tseslint from "typescript-eslint"
import { defineConfig } from "eslint/config"

export default defineConfig([
  { ignores: ["build/"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
])
