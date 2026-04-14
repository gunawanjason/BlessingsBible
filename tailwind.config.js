import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sage: {
          50: "#f6f7f6",
          100: "#e3e7e3",
          200: "#c7d2c7",
          300: "#a3b5a3",
          400: "#7d947d",
          500: "#5f7a5f",
          600: "#4a624a",
          700: "#3d503d",
          800: "#334133",
          900: "#2b362b",
        },
        cream: {
          50: "#fefdf8",
          100: "#fdf9f0",
          200: "#faf2e1",
          300: "#f5e8cc",
          400: "#eed9a7",
          500: "#e5c47a",
          600: "#d9b05c",
          700: "#c19a4f",
          800: "#9e7d42",
          900: "#806637",
        },
        rust: {
          50: "#fdf7f4",
          100: "#fbeee7",
          200: "#f6ddd0",
          300: "#efc5b0",
          400: "#e5a486",
          500: "#d9825f",
          600: "#c96a45",
          700: "#a7553a",
          800: "#874536",
          900: "#6e3930",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [typography],
};
