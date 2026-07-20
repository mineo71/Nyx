/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js}'],
  theme: {
    extend: {
      fontFamily: { sans: ['-apple-system', 'SF Pro Text', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
