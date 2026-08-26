/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        moss: '#0B5B31',
        clay: '#ED1C24',
        slate: '#3C3C3B',
        sage: '#666666',
        sand: '#F9F9F9',
        cream: '#FFFFFF',
      }
    },
  },
  plugins: [],
}
