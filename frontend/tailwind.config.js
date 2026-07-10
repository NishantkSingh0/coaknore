/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
        oak: '#2c2118',
        ore: '#c2a47d',
      },

      keyframes: {
        wave: {
          '0%': { transform: 'rotate(0deg)' },
          '3%': { transform: 'rotate(14deg)' },
          '6%': { transform: 'rotate(-8deg)' },
          '9%': { transform: 'rotate(14deg)' },
          '12%': { transform: 'rotate(-4deg)' },
          '15%': { transform: 'rotate(10deg)' },
          '18%': { transform: 'rotate(0deg)' },

          /* Stay still for the remaining ~5 seconds */
          '100%': { transform: 'rotate(0deg)' },
        },
      },

      animation: {
        wave: 'wave 7s ease-in-out infinite',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}