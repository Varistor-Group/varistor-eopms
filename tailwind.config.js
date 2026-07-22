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
