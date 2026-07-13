import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Violet — matches the design handoff (#6c5ce7 primary).
        brand: {
          50: "#f2f1fd", 100: "#e7e4fb", 200: "#d2ccf7", 300: "#b4a9f1",
          400: "#9b8cf5", 500: "#7c6cf5", 600: "#6c5ce7", 700: "#5546d4",
          800: "#4a3cb0", 900: "#3d3290", 950: "#241d5c",
        },
        // Dark violet sidebar / ink.
        ink: { DEFAULT: "#12101f", 900: "#12101f", 800: "#171531", 700: "#211d3f" },
      },
      borderRadius: { xl: "0.75rem", "2xl": "1rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(20,18,45,.04)",
        card: "0 1px 2px rgba(20,18,45,.05), 0 8px 24px -16px rgba(20,18,45,.18)",
        glow: "0 4px 14px rgba(124,108,245,.4)",
      },
    },
  },
  plugins: [],
};

export default config;
