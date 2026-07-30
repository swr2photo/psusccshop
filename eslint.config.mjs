import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Non-production utility / migration scripts:
    "scratch/**",
    "scripts/**",
    "server/**",
    "public/sw.js",
    "next.config.ts",
    "prisma.config.ts",
  ]),
]);

export default eslintConfig;
