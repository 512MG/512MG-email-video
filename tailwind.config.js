/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"],
        display: ['"Bricolage Grotesque Variable"', '"Inter Variable"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#14141a",
        brand: { DEFAULT: "#e11d48", dark: "#be123c" },
        // Landing page palette
        plum: { DEFAULT: "#241332", soft: "#6B6178", line: "#DCD3EA" },
        lilac: "#EEE9F7",
        rec: "#FFC93C",
      },
    },
  },
  plugins: [],
};
