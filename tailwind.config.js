/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#5F4B3A',
          light: '#7A644F',
          muted: '#9A8168',
        },
        accent: {
          DEFAULT: '#E67E22',
          light: '#F2A65A',
          dark: '#C96A18',
        },
        surface: {
          DEFAULT: '#F5EBDD',
          alt: '#EADCC8',
          card: '#FFF8EE',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
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
        card: '0 12px 36px rgba(95, 75, 58, 0.15)',
        hero: '0 30px 90px rgba(95, 75, 58, 0.22)',
        button: '0 14px 30px rgba(201, 106, 24, 0.35)',
      },
    },
  },
  plugins: [],
}
