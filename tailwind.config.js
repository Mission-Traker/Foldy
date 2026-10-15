/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F4ECDF', paper: '#FFFBF4', line: '#E7DCC9',
        slate: { DEFAULT: '#4F6EA8', deep: '#3E5486' },
        coral: '#E08A7B', tang: '#E9954B', sage: '#8DAE78', mustard: '#E3B23C',
        ink: '#3A3A4A', soft: '#8C8577',
      },
      fontFamily: {
        title: ['Fredoka', 'Jua', 'sans-serif'],
        jua: ['Jua', 'sans-serif'],
        body: ['"Gowun Dodum"', 'Jua', 'sans-serif'],
      },
      boxShadow: { card: '0 3px 0 #E2D5BF', pop: '0 4px 0 #3E5486' },
    },
  },
  plugins: [],
}
