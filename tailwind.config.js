/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'font-crimson',
    'font-roboto',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1C2A39',     // Deep navy - headers, primary text, navigation icons
        accent: '#E3B23C',      // Warm gold - primary buttons, highlights, active states
        background: '#FAF9F6',  // Off-white - page background, cards
        success: '#3CB371',     // Gentle green - correct review result
        error: '#FF6F61',       // Soft coral - needs work result
      },
      fontFamily: {
        'roboto': ['Roboto', 'sans-serif'],
        'crimson': ['Crimson Text', 'serif'],
      },
    },
  },
  plugins: [],
}