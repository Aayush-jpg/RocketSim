/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base colors
        'bg-deep': '#0A0C12',
        'bg-surface': '#1A1E28',
        // Glass tint 
        'glass': '#E0E5F2',
        // Neon colors
        'neon-primary': '#A0A7B8',
        'neon-secondary': '#5EEAFF',
        // Accent colors
        'accent-alert': '#FF4A6D',
        'accent-success': '#00E5A0',
        'accent-warning': '#FFB800',
        'accent-info': '#7B8CFF',
        // Text colors
        'text-primary': '#FFFFFF',
        'text-secondary': '#D0D5E2',
      },
      fontFamily: {
        'sans': ['Inter', 'SF Pro Display', 'SF Pro Text', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        'panel-header': '1.125rem', // 18px
        'section-header': '1rem',    // 16px
        'body': '0.875rem',          // 14px
        'small': '0.75rem',          // 12px
        'metrics': '0.8125rem',      // 13px
      },
      backdropBlur: {
        'xs': '5px',
        'sm': '8px',
        'md': '10px',
        'lg': '15px',
      },
      boxShadow: {
        'neon': '0 0 5px rgba(160, 167, 184, 0.5), inset 0 0 5px rgba(160, 167, 184, 0.2)',
        'neon-active': '0 0 8px rgba(94, 234, 255, 0.6), inset 0 0 8px rgba(94, 234, 255, 0.3)',
      }
    },
  },
  plugins: [],
} 
