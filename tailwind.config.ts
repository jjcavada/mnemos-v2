import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { 0:"#08080a", 1:"#0e0e11", 2:"#16161a", 3:"#1d1d22", 4:"#26262c" },
        border: { DEFAULT:"#2a2a30", strong:"#3a3a43" },
        text: { 1:"#f4f4f5", 2:"#a8a8b1", 3:"#6b6b75", 4:"#4a4a52" },
        accent: { DEFAULT:"#818cf8", bright:"#a5b4fc" },
        life: "#4a4a52"
      },
      fontFamily: {
        sans: ["Inter","-apple-system","BlinkMacSystemFont","sans-serif"],
        mono: ["JetBrains Mono","ui-monospace","monospace"]
      }
    }
  },
  plugins: []
};
export default config;
