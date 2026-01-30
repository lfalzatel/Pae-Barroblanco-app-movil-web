/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    'dark:bg-gray-800',
    'dark:bg-gray-900',
    'dark:text-white',
    'dark:border-gray-700',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#10b981',
        accent: '#f59e0b',
      },
    },
  },
  plugins: [],
}
