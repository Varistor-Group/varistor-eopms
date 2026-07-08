/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'xs': 'clamp(0.7rem, 0.7rem + 0.1vw, 0.75rem)',
        'sm': 'clamp(0.8rem, 0.8rem + 0.15vw, 0.875rem)',
        'base': 'clamp(0.875rem, 0.875rem + 0.25vw, 1rem)',
        'lg': 'clamp(1rem, 1rem + 0.35vw, 1.125rem)',
        'xl': 'clamp(1.125rem, 1.125rem + 0.5vw, 1.25rem)',
        '2xl': 'clamp(1.25rem, 1.25rem + 0.75vw, 1.5rem)',
        '3xl': 'clamp(1.5rem, 1.5rem + 1vw, 1.875rem)',
        '4xl': 'clamp(1.875rem, 1.875rem + 1.2vw, 2.25rem)',
        '5xl': 'clamp(2.25rem, 2.25rem + 1.5vw, 3rem)',
      },
      colors: {
        brand: {
          lime: '#a3e635',
          limeTint: '#ecfccb',
          ink: '#111111',
        },
        varistor: {
          lime: '#84cc16', // Primary Action / Accent (Lime green)
          limeLight: '#f7fee7', // Lightest lime-tint for background
          limeTint: '#eefed4', // Standard lime-tint for badges/success
          limeText: '#2c4e02', // Dark green contrast text for lime backgrounds
          border: '#D8DED2', // Subtle 1px border color
          muted: '#868e80', // Muted captions & subtitles
          dark: '#111111', // Ink black text color
          pageBg: '#f4f6f3', // Light page background
          
          // Status pills mapping
          successBg: '#eefed4',
          successText: '#2c4e02',
          successBorder: '#d2f3a6',
          
          pendingBg: '#f1f3f0',
          pendingText: '#555a52',
          pendingBorder: '#e1e4e0',
          
          dangerBg: '#fef2f2',
          dangerText: '#b91c1c',
          dangerBorder: '#fee2e2'
        }
      },
      borderRadius: {
        varistor: '12px',
      },
      boxShadow: {
        varistor: '0 1px 2px rgba(0,0,0,0.04)',
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
