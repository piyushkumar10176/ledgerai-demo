import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        // Deep teal / pine — distinctive, not the usual indigo.
        brand: {
          50: "#effcf9", 100: "#d6f5ee", 200: "#aee9dd", 300: "#79d6c6",
          400: "#45bcaa", 500: "#1fa08f", 600: "#0f766e", 700: "#0c5f59",
          800: "#0d4c48", 900: "#0e3f3c", 950: "#042522",
        },
        // Warm near-black for the sidebar / ink.
        ink: { DEFAULT: "#1a1714", 900: "#1a1714", 800: "#231e19", 700: "#2f2822", 600: "#40372f" },
        // Warm ochre accent for highlights.
        gold: { 100: "#faedd6", 400: "#e0a13a", 500: "#c9862a", 600: "#a86c1e" },
      },
      borderRadius: { "2xl": "1.1rem", "3xl": "1.5rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(26,23,20,.04), 0 12px 28px -18px rgba(26,23,20,.20)",
        lift: "0 2px 6px rgba(26,23,20,.05), 0 20px 44px -22px rgba(15,118,110,.28)",
      },
    },
  },
  plugins: [],
};

export default config;
