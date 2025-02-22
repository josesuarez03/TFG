/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors:{
        primary: {
          DEFAULT: '#0080cb', // Color principal (600)
          50: '#f0f9ff',
          100: '#e0f1fe',
          200: '#b9e4fe',
          300: '#7ccffd',
          400: '#36b8fa',
          500: '#0c9feb',
          600: '#0080cb',
          700: '#0164a3',
          800: '#065586',
          900: '#0b476f',
          950: '#072d4a',
        },
        background: {
          DEFAULT: '#F8F9FA', // Mantenemos el blanco puro
          alt: '#FFFFFF',     // Blanco Absoluto
        },
        text: {
          DEFAULT: '#2E2E2E', // Gris Oscuro
          light: '#757575',   // Gris para bordes
        },
        // Escala de grises personalizada
        gray: {
          100: '#F8F9FA',
          200: '#E9ECEF',
          300: '#DEE2E6',
          400: '#CED4DA',
          500: '#757575',
          600: '#2E2E2E',
          700: '#212529',
        },

        borderRadius: {
          DEFAULT: '8px',
          'sm': '8px',
          'md': '8px',
          'lg': '8px',
          'xl': '8px',
        },
        borderColor: {
          DEFAULT: '#757575',
        },
      }
    },
  },
  plugins: [],
}

