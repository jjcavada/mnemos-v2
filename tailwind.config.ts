import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#050505",
          1: "rgba(20, 20, 20, 0.6)",
          2: "rgba(28, 28, 30, 0.55)",
          3: "rgba(38, 38, 40, 0.5)",
          4: "#1a1a1d"
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          strong: "rgba(255, 255, 255, 0.16)"
        },
        text: {
          1: "#F4F4F5",
          2: "#A1A1AA",
          3: "#71717A",
          4: "#52525B"
        },
        accent: {
          DEFAULT: "#E5E5E5",
          bright: "#FFFFFF"
        },
        life: "#52525B"
      },
      fontFamily: {
        sans: ["Geist Sans", "Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "Geist", "ui-monospace", "monospace"]
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px"
      }
    }
  },
  plugins: []
};
export default config;
