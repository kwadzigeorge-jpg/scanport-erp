/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1e3a5f', light: '#2563eb', dark: '#0f1f3d' },
      },
    },
  },
  plugins: [],
};
