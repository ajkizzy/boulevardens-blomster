/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5ed',
          100: '#dce8d4',
          200: '#b9d1a9',
          300: '#8fb57a',
          400: '#6a9a52',
          500: '#4a7a35',
          600: '#3a6129',
          700: '#2d4a20',
          800: '#1f3316',
          900: '#162510',
        },
        accent: {
          50: '#fdf2f4',
          100: '#fbe5e9',
          200: '#f8cdd5',
          300: '#f2a5b3',
          400: '#e8748a',
          500: '#d94f6a',
          600: '#c43254',
          700: '#a42545',
          800: '#89223e',
          900: '#751f39',
        },
        warm: {
          50: '#fdfaf6',
          100: '#f9f3ea',
          200: '#f2e6d5',
          300: '#e8d3b8',
        },
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
