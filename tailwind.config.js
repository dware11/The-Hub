/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        purple: {
          900: '#241748',
          700: '#3D2A70',
          100: '#EFEAFB',
        },
        gold: {
          600: '#B8912B',
          400: '#D4AF37',
          100: '#F6EDD1',
        },
        paper: '#FBFAF8',
        ink: '#18151F',
        slate: '#6B6875',
        line: '#E7E2EF',
        coral: '#B8562F',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-plex-sans)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
