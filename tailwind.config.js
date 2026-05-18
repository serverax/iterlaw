/** Root Tailwind config — mirrors apps/web tokens for tooling that reads repo root */
module.exports = {
  content: [
    './apps/web/app/**/*.{js,ts,jsx,tsx}',
    './apps/web/components/**/*.{js,ts,jsx,tsx}',
  ],
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
    },
  },
  plugins: [],
};
