/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1c1917',
          panel: '#292524',
          border: '#44403c',
          amber: '#f59e0b',
          orange: '#c25e00',
          emerald: '#10b981',
          rose: '#f43f5e',
        },
      },
    },
  },
  plugins: [],
};
