import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
        },
        // BizHaus's real signature green, pulled from the marketing site's
        // actual button CSS (.bttn-base.bttn-one → #6ec664). Used for the
        // public-facing booking flows (/book, /day-pass) only — the member
        // portal itself stays on the existing blue.
        booking: {
          50: '#eefaec',
          100: '#dbf3d7',
          200: '#b8e7b0',
          300: '#93d986',
          400: '#7ed070',
          500: '#74ca69',
          600: '#6ec664',
          700: '#4f9e48',
          800: '#3b7736',
        },
      },
    },
  },
  plugins: [],
}

export default config
