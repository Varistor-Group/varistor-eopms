/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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
