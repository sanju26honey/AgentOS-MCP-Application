/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#a5c8ff",
        "primary-container": "#3395ff",
        "on-primary": "#00315e",
        "on-primary-container": "#002d58",
        "secondary": "#d0bcff",
        "secondary-container": "#571bc1",
        "tertiary": "#ffb77f",
        "tertiary-container": "#e07800",
        "surface": "#10141a",
        "surface-container": "#1c2026",
        "surface-container-high": "#262a31",
        "surface-container-highest": "#31353c",
        "surface-container-low": "#181c22",
        "surface-container-lowest": "#0b0e14",
        "surface-variant": "#31353c",
        "on-surface": "#e0e2eb",
        "on-surface-variant": "#c0c7d5",
        "background": "#10141a",
        "outline": "#8a919e",
        "outline-variant": "#404753",
        "error": "#ffb4ab",
        "error-container": "#93000a",
        merchant: {
          navy: '#0C2356',
          blue: '#0052CC',
          bg: '#10141a',
        },
        agent: {
          violet: '#7C3AED',
          emerald: '#059669',
          coral: '#EA580C',
          indigo: '#4F46E5',
        },
        lumina: {
          bg: '#f7f9fb',
          surface: '#f7f9fb',
          'surface-dim': '#d8dadc',
          'surface-bright': '#f7f9fb',
          'surface-container-lowest': '#ffffff',
          'surface-container-low': '#f2f4f6',
          'surface-container': '#eceef0',
          'surface-container-high': '#e6e8ea',
          'surface-container-highest': '#e0e3e5',
          'on-surface': '#191c1e',
          'on-surface-variant': '#464554',
          'outline': '#767586',
          'outline-variant': '#c7c4d7',
          primary: '#4648d4',
          'primary-container': '#6063ee',
          secondary: '#8127cf',
          tertiary: '#006577',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      spacing: {
        "margin-desktop": "32px",
        "gutter": "24px",
        "margin-mobile": "16px"
      }
    },
  },
  plugins: [],
};
