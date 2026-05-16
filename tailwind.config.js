/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'hex-bg':      '#0d1117',
        'hex-surface': '#141b27',
        'hex-card':    'rgba(255,255,255,0.04)',
        'hex-border':  'rgba(255,255,255,0.08)',
        'hex-blue':    '#3b8fe8',
        'hex-gold':    '#f5a623',
        'hex-red':     '#e84040',
      },
      fontFamily: {
        exo: ['"Exo 2"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
