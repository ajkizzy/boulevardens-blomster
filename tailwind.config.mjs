/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#fafaf5',
          low: '#f4f4ef',
          mid: '#eeeee9',
          raised: '#ffffff',
          tint: '#c4c8bd',
          ink: '#1a1c19',
        },
        primary: {
          50: '#f1f4ef',
          100: '#dbe3d6',
          200: '#c4cfbc',
          300: '#aab99f',
          400: '#90a384',
          500: '#526349',
          600: '#46553f',
          700: '#394533',
          800: '#2d3628',
          900: '#21271d',
        },
        secondary: {
          50: '#f6f1ef',
          100: '#eadcd7',
          200: '#d8c1b9',
          300: '#c4a398',
          400: '#a98679',
          500: '#755850',
          600: '#664b44',
          700: '#543d37',
          800: '#42302c',
          900: '#2c211e',
        },
        accent: {
          50: '#f4efe7',
          100: '#e9decd',
          200: '#dac7a9',
          300: '#c7ac7f',
          400: '#b68f5a',
          500: '#977046',
          600: '#7b5b39',
          700: '#60472d',
          800: '#453321',
          900: '#2c2014',
        },
      },
      fontFamily: {
        heading: ['"Noto Serif"', 'Georgia', 'serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ambient: '0 12px 40px rgba(26, 28, 25, 0.06)',
      },
    },
  },
  plugins: [],
};
