import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react/no-danger": "error",
    },
  },
  {
    files: ["src/app/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@/server/supabase/*"],
              message: "Pages read data through @/server/data only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**", "src/app/**/error.tsx", "src/app/global-error.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/env/server", "@/server/*", "@/server/**", "**/env/server", "@supabase/*"],
              message: "Components must not import server-only modules or query Supabase.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
