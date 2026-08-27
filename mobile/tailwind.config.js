/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sand: '#F9F9F9',
        sage: '#666666',
        moss: '#0B5B31',
        clay: '#ED1C24',
        slate: '#3C3C3B',
        cream: '#FFFFFF',
        primary: {
          50: '#F2F6F4',
          100: '#E1EBE5',
          200: '#C3D3CA',
          300: '#9EACA4',
          400: '#7CAC94',
          500: '#10472B', // Forest Green
          600: '#0D3822',
          700: '#0A2A1A',
          800: '#071D12',
          900: '#041009',
        },
        accent: '#E31B23', // Primary Red
        taupe: '#9C8F80',
        background: '#FFFFFF', // Pure White
      }
    },
  },
  plugins: [],
}
