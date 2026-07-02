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
          ink: 'var(--brand-ink)',
        },
        varistor: {
          lime: '#84cc16', // Primary Action / Accent (Lime green) - stays constant across themes
          limeLight: 'var(--varistor-limeLight)', // Lightest lime-tint for background
          limeTint: 'var(--varistor-limeTint)', // Standard lime-tint for badges/success
          limeText: 'var(--varistor-limeText)', // Dark green contrast text for lime backgrounds
          border: 'var(--varistor-border)', // Subtle 1px border color
          muted: 'var(--varistor-muted)', // Muted captions & subtitles
          dark: 'var(--varistor-dark)', // Primary ink text color
          pageBg: 'var(--varistor-pageBg)', // Page background
          surface: 'var(--varistor-surface)', // Card / panel background (replaces literal white)
          surfaceMuted: 'var(--varistor-surfaceMuted)', // Secondary hover/tab background

          // Status pills mapping
          successBg: 'var(--varistor-successBg)',
          successText: 'var(--varistor-successText)',
          successBorder: 'var(--varistor-successBorder)',

          pendingBg: 'var(--varistor-pendingBg)',
          pendingText: 'var(--varistor-pendingText)',
          pendingBorder: 'var(--varistor-pendingBorder)',

          dangerBg: 'var(--varistor-dangerBg)',
          dangerText: 'var(--varistor-dangerText)',
          dangerBorder: 'var(--varistor-dangerBorder)'
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
