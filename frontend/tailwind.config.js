/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Official brand palette (docs/brand/BRAND-GUIDELINES.md) ──
        // Use these names for all NEW code.
        navy: {
          900: '#111C36', // app background
          800: '#1A2745', // surface / card
          700: '#1E2D50', // primary brand navy
          600: '#2A3A63', // borders on dark
          500: '#33477A', // hover, secondary elements
          300: '#8FA0C4', // secondary text on dark
          100: '#E4E9F4', // light tints, text on navy-700
        },
        gold: {
          600: '#E09E00', // accent hover/pressed
          500: '#FFB81C', // accent — CTAs, active states
          200: '#FFE099', // accent tint
        },
        grey: {
          900: '#1A1D23',
          600: '#5A6270',
          400: '#9AA1AD',
          200: '#E2E5EA',
          50: '#F6F7F9',
        },
        success: { DEFAULT: '#2E9E5B', dark: '#4CBF7F' }, // .dark = on-dark variant
        error: { DEFAULT: '#D64545', dark: '#E86A6A' },
        warning: { DEFAULT: '#E8890C' },
        info: { DEFAULT: '#2B7FD4' },

        // ── DEPRECATED legacy aliases → brand hexes ──
        // court/spike/chalk are kept so existing classes keep working; they
        // now point at brand colours. Do not use in new code; migrate to
        // navy/gold/grey when touching a file. Do not delete.
        court: { 950: '#111C36', 900: '#1A2745', 800: '#1E2D50', 700: '#2A3A63', 600: '#33477A' },
        spike: { 400: '#FFB81C', 500: '#FFB81C', 600: '#E09E00' },
        // 300/500/700 were never defined pre-brand (those classes silently
        // inherited); mapped here so muted labels render muted as intended.
        chalk: { 100: '#FFFFFF', 200: '#E4E9F4', 300: '#E4E9F4', 400: '#8FA0C4', 500: '#8FA0C4', 600: '#5A6270', 700: '#33477A' },
      },
      fontFamily: {
        // Athletic display face for headings (brand §3)
        display: ['Barlow Semi Condensed', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // DEPRECATED alias — stats historically used font-mono; the brand uses
        // Inter with tabular figures instead (pair with the .tabular utility).
        mono: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
