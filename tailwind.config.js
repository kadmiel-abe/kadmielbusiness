/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': {
          DEFAULT: '#0f172a',
          hover: '#020617',
          light: '#1e293b',
        },
        // Palette Officielle Vert Pur extrait du logo (#119134 & #16a83d)
        emerald: {
          50: '#edfdf2',
          100: '#d4f9df',
          200: '#acf3c2',
          300: '#74e798',
          400: '#16a83d',
          500: '#119134', // Vert pur exact du logo
          600: '#0d772a',
          700: '#0a5d22',
          800: '#08481b',
          900: '#073c16',
          950: '#03200b',
        },
        green: {
          50: '#edfdf2',
          100: '#d4f9df',
          200: '#acf3c2',
          300: '#74e798',
          400: '#16a83d',
          500: '#119134', // Vert pur exact du logo
          600: '#0d772a',
          700: '#0a5d22',
          800: '#08481b',
          900: '#073c16',
          950: '#03200b',
        },
        brand: {
          DEFAULT: '#119134',
          pure: '#119134',
          bright: '#16a83d',
          dark: '#0d772a',
          glow: 'rgba(17, 145, 52, 0.35)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
