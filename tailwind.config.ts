import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1a2744",
          orange: "#e8713a",
          "navy-light": "#243356",
          "orange-light": "#f09d6e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
