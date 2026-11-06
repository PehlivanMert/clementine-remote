/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hifi: {
          950: '#07080a',
          900: '#0c0d10',
          850: '#111317',
          800: '#181a20',
          700: '#232630',
          600: '#323745',
          accent: '#f59e0b',
          accentHover: '#d97706',
          cyan: '#38bdf8',
          green: '#10b981',
          danger: '#ef4444'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
