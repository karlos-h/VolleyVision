/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VolleyVision brand palette
        // Court: deep navy evokes indoor court floors and professional sports
        court: {
          950: '#050d1a',
          900: '#0a1628',
          800: '#0f2040',
          700: '#162d58',
          600: '#1f3d73',
        },
        // Spike: electric amber — the energy of the sport
        spike: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Chalk: the lines on the court
        chalk: {
          100: '#f0f4f8',
          200: '#dde6ef',
          400: '#94a3b8',
          600: '#64748b',
        },
      },
      fontFamily: {
        // Tabular figures for numbers/stats throughout
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
