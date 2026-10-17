import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        forge: {
          bg: "#0B0E14",
          surface: "#121721",
          card: "#19202E",
          border: "#263248",
          primary: "#3B82F6",
          accent: "#6366F1",
          highlight: "#F59E0B",
          danger: "#EF4444",
          success: "#10B981"
        }
      }
    },
  },
  plugins: [],
};
export default config;
