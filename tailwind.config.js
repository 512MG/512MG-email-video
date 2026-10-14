/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      colors: { ink: "#14141a", brand: { DEFAULT: "#e11d48", dark: "#be123c" } },
    },
  },
  plugins: [],
};
