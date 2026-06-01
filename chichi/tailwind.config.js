/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF6F0',
        espresso: '#2A1F14',
        sienna: {
          DEFAULT: '#B5651D',
          light: '#D4895A',
          dark: '#8B4513',
        },
        sage: {
          DEFAULT: '#4A7C59',
          light: '#6B9E79',
          dark: '#2D5140',
        },
        wheat: '#E8D5B0',
        muted: '#8B7355',
        divider: '#E2D5C3',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-pattern': "radial-gradient(circle at 20% 50%, #E8D5B0 0%, transparent 50%), radial-gradient(circle at 80% 20%, #D4895A22 0%, transparent 40%), radial-gradient(circle at 60% 80%, #4A7C5911 0%, transparent 40%)",
      },
    },
  },
  plugins: [],
}
