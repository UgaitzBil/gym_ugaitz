/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bilbo: {
          400: '#c084fc',
          500: '#a855f7',
        },
      },
    },
  },
  plugins: [],
}
