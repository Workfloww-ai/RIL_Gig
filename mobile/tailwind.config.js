/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F2F6F4',
          100: '#E1EBE5',
          200: '#C3D3CA',
          300: '#9EACA4', // palette gray-green
          400: '#7CAC94', // palette muted green
          500: '#4B8361',
          600: '#2E704C',
          700: '#115D36', // palette main green
          800: '#0E4A2B',
          900: '#0B3820',
        },
        accent: '#E82129', // palette red
        taupe: '#9C8F80', // palette brownish gray
        background: '#FAFAFA', // palette off-white
      }
    },
  },
  plugins: [],
}
