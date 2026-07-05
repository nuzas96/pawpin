import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, map-forward brand palette.
        brand: {
          50: "#fdf6ee",
          100: "#f8e6d1",
          200: "#f0c79b",
          300: "#e7a563",
          400: "#df8a3b",
          500: "#d1701f",
          600: "#b0571a",
          700: "#8c4319",
          800: "#71361a",
          900: "#5d2e19",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
