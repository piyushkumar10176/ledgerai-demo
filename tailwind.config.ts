import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc",
          400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca",
          800: "#3730a3", 900: "#312e81", 950: "#1e1b4b",
        },
        ink: { DEFAULT: "#0b1220", 900: "#0b1220", 800: "#111a2e", 700: "#1b2742", 600: "#26355a" },
      },
      borderRadius: { "2xl": "1rem", "3xl": "1.25rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 10px 30px -14px rgba(16,24,40,.18)",
        glow: "0 0 0 1px rgba(99,102,241,.15), 0 12px 40px -16px rgba(99,102,241,.35)",
      },
    },
  },
  plugins: [],
};

export default config;
