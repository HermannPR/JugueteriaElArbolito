import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta El Arbolito — colores directos
        primary: {
          DEFAULT: "#1E40AF",
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "#3B82F6",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#E11D48",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#F8FAFC",
          foreground: "#1e293b",
        },
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#64748b",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
        background: "#ffffff",
        foreground: "#0f172a",
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#3B82F6",
      },
      fontFamily: {
        display: ["var(--font-poppins)", "sans-serif"],
        body:    ["var(--font-inter)", "sans-serif"],
        sans:    ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};
export default config;
