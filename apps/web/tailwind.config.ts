import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0D0F14',
        slate: '#1A1D26',
        steel: '#252836',
        gold: '#C9A84C',
        'text-primary': '#F0EDE6',
        'text-secondary': '#9A97A0',
        'text-tertiary': '#5C5A65',
        'signal-red': '#E05555',
        'signal-green': '#52A882',
        'signal-amber': '#E09A45',
        'signal-blue': '#4A90E2',
      },
      fontFamily: {
        fraunces: ['var(--font-fraunces)', 'Georgia', 'serif'],
        'dm-sans': ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display: ['34px', { lineHeight: '1.2', fontWeight: '300' }],
        h1: ['28px', { lineHeight: '1.3', fontWeight: '400' }],
        h2: ['24px', { lineHeight: '1.3', fontWeight: '400' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        body: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        label: ['12px', { lineHeight: '1.3', fontWeight: '500' }],
        code: ['13px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '999px',
      },
    },
  },
  plugins: [],
};

export default config;
