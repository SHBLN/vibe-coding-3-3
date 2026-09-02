/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0D1B3E',
          light: '#152952',
          muted: '#1E3660',
        },
        accent: {
          DEFAULT: '#ED7839',
          light: '#F28F52',
          dark: '#D9652A',
        },
        surface: {
          DEFAULT: '#F3F4F6',
          alt: '#E5E7EB',
          card: '#ECEEF2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3.5rem',
      },
      boxShadow: {
        card: '0 16px 50px rgba(13, 27, 62, 0.10)',
        hero: '0 28px 80px rgba(13, 27, 62, 0.18)',
        button: '0 12px 28px rgba(237, 120, 57, 0.35)',
      },
    },
  },
  plugins: [],
}
