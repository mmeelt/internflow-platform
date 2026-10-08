/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--cream-rgb) / <alpha-value>)",
        "cream-dark": "rgb(var(--cream-dark-rgb) / <alpha-value>)",
        charcoal: "rgb(var(--charcoal-rgb) / <alpha-value>)",
        "charcoal-soft": "rgb(var(--charcoal-soft-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        "muted-light": "rgb(var(--muted-light-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        "border-light": "rgb(var(--border-light-rgb) / <alpha-value>)",
        lavender: "rgb(var(--lavender-rgb) / <alpha-value>)",
        "lavender-deep": "rgb(var(--lavender-deep-rgb) / <alpha-value>)",
        grey: {
          50: "rgb(var(--grey-50-rgb) / <alpha-value>)",
          100: "rgb(var(--grey-100-rgb) / <alpha-value>)",
          200: "rgb(var(--grey-200-rgb) / <alpha-value>)",
          300: "rgb(var(--grey-300-rgb) / <alpha-value>)",
          400: "rgb(var(--grey-400-rgb) / <alpha-value>)",
          500: "rgb(var(--grey-500-rgb) / <alpha-value>)",
          600: "rgb(var(--grey-600-rgb) / <alpha-value>)",
          700: "rgb(var(--grey-700-rgb) / <alpha-value>)",
          800: "rgb(var(--grey-800-rgb) / <alpha-value>)",
          900: "rgb(var(--grey-900-rgb) / <alpha-value>)",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 2px 16px rgba(17, 24, 39, 0.06)",
        card: "0 1px 3px rgba(17, 24, 39, 0.04), 0 4px 12px rgba(17, 24, 39, 0.03)",
        float: "0 8px 32px rgba(17, 24, 39, 0.1)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
