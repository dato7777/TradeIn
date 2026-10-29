import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f1419",
          card: "#1a2332",
          border: "#2d3a4f",
        },
        accent: {
          DEFAULT: "#3b82f6",
          muted: "#1e3a5f",
        },
        pub: {
          bg: "#ffffff",
          surface: "#f8fafc",
          border: "#e2e8f0",
          fg: "#0f172a",
          muted: "#475569",
          primary: "#1d4ed8",
          "primary-hover": "#1e40af",
          "primary-tint": "#EFF6FF",
          "primary-tint-border": "#BFDBFE",
          cta: "#047857",
          "cta-hover": "#065f46",
          best: "#ecfdf5",
          "best-fg": "#065f46",
          warning: "#b45309",
          error: "#b91c1c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
