/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Notion-like palette
        // Set by the app theme (see src/lib/appThemes.ts); defaults in index.css.
        canvas: { light: 'rgb(var(--pn-canvas-light) / <alpha-value>)', dark: 'rgb(var(--pn-canvas-dark) / <alpha-value>)' },
        sidebar: { light: 'rgb(var(--pn-sidebar-light) / <alpha-value>)', dark: 'rgb(var(--pn-sidebar-dark) / <alpha-value>)' },
        ink: { light: 'rgb(var(--pn-ink-light) / <alpha-value>)', dark: 'rgb(var(--pn-ink-dark) / <alpha-value>)' },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'tree-in': { from: { opacity: '0', transform: 'translateY(-3px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.97) translateY(-4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'tree-in': 'tree-in 110ms ease-out',
        'pop-in': 'pop-in 140ms ease-out',
      },
    },
  },
  plugins: [],
}
