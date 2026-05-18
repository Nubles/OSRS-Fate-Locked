/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        osrs: {
          bg: '#161616',
          panel: '#2d2d2d',
          border: '#3e3e3e',
          gold: '#fbbf24',
          text: '#d1d5db',
          accent: '#8b5cf6',
          success: '#22c55e',
          fail: '#ef4444',
          pity: '#f59e0b'
        }
      },
      animation: {
        'void-spin': 'void-spin 3s linear infinite',
        'spin-reverse': 'spin-reverse 4s linear infinite',
        'implode': 'implode 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'shake': 'shake 0.1s linear infinite',
        'flash': 'flash 0.5s ease-out forwards',
        'float-up': 'float-up 1s ease-out forwards',
        'god-ray': 'spin-slow 10s linear infinite',
        'glitch': 'glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite',
        'rain': 'rain 1s linear infinite',
        'focus': 'focus 2s ease-in-out forwards',
        'loading-bar': 'loading-bar 0.6s linear forwards',
      },
      keyframes: {
        'void-spin': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '50%': { transform: 'rotate(180deg) scale(0.9)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
        'spin-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'implode': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0)', opacity: '0' },
        },
        'shake': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(-2px, 2px)' },
          '50%': { transform: 'translate(2px, -2px)' },
          '75%': { transform: 'translate(-2px, -2px)' },
        },
        'flash': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '50%': { opacity: '1', transform: 'scale(2)' },
          '100%': { opacity: '0', transform: 'scale(3)' },
        },
        'float-up': {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.8)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'glitch': {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' }
        },
        'rain': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' }
        },
        'focus': {
          '0%': { filter: 'blur(10px)', transform: 'scale(1.5)', opacity: '0' },
          '50%': { filter: 'blur(0px)', transform: 'scale(1)', opacity: '1' },
          '100%': { filter: 'blur(0px)', transform: 'scale(1)', opacity: '1' }
        },
        'loading-bar': {
          '0%': { width: '0%' },
          '100%': { width: '100%' }
        }
      }
    }
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
