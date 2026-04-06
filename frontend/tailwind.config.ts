import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    fontFamily: {
      display: ['Syne', 'sans-serif'],
      body: ['Space Grotesk', 'sans-serif'],
      mono: ['DM Mono', 'monospace'],
    },
    extend: {
      colors: {
        base: '#0a0a0b',
        surface: '#141416',
        elevated: '#1c1c1f',
        accent: {
          DEFAULT: '#c8a44e',
          hover: '#d4b35e',
          subtle: 'rgba(200, 164, 78, 0.08)',
        },
        border: {
          DEFAULT: '#232326',
          strong: '#3a3a3e',
        },
        txt: {
          primary: '#e8e6e3',
          secondary: '#a09d98',
          muted: '#5c5a56',
        },
        win: '#5cb87a',
        lose: '#d45454',
        draw: '#c8a44e',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.5' }],
        'base': ['1rem', { lineHeight: '1.6' }],
        'lg': ['1.25rem', { lineHeight: '1.5' }],
        'xl': ['1.5rem', { lineHeight: '1.3' }],
        '2xl': ['2rem', { lineHeight: '1.2' }],
        '3xl': ['2.5rem', { lineHeight: '1.15' }],
        '4xl': ['3rem', { lineHeight: '1.1' }],
        '5xl': ['4rem', { lineHeight: '1.05' }],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-up-d1': 'fade-up 0.5s ease-out 0.05s both',
        'fade-up-d2': 'fade-up 0.5s ease-out 0.1s both',
        'fade-up-d3': 'fade-up 0.5s ease-out 0.15s both',
        'fade-up-d4': 'fade-up 0.5s ease-out 0.2s both',
        'fade-up-d5': 'fade-up 0.5s ease-out 0.25s both',
        'fade-in': 'fade-in 0.3s ease-out both',
        shimmer: 'shimmer 2s linear infinite',
        'scale-in': 'scale-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
