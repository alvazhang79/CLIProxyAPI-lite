/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: '#FF6B35',
          dark: '#E85A24',
        },
        teal: {
          DEFAULT: '#4ECDC4',
          dark: '#3DBDB5',
        },
        navy: {
          DEFAULT: '#2C2C54',
          light: '#3D3D6B',
        },
      },
      fontFamily: {
        mono: ["'Courier New'", 'Courier', 'monospace'],
        sans: ['Inter', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
