/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0f0b24",
          900: "#171034",
          800: "#221a45",
          700: "#2f2560",
        },
        verse: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
        },
        parchment: {
          50: "#fbf9f4",
          100: "#f4efe3",
        },
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
