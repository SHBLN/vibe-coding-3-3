/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F172A',
          light: '#1E293B',
          muted: '#334155',
        },
        accent: {
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
          dark: '#2563EB',
        },
        surface: {
          DEFAULT: '#F1F5F9',
          alt: '#E2E8F0',
          card: '#FFFFFF',
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
        card: '0 12px 36px rgba(15, 23, 42, 0.12)',
        hero: '0 30px 90px rgba(15, 23, 42, 0.20)',
        button: '0 14px 30px rgba(37, 99, 235, 0.35)',
      },
    },
  },
  plugins: [],
}
