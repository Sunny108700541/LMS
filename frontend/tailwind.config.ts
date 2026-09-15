import type { Config } from 'tailwindcss';

/**
 * Deliberately narrow palette: white ground, black type, one neutral ramp for
 * structure and a muted set for status. Nothing decorative.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        paper: '#ffffff',
        line: '#e5e5e5',
        muted: '#6b6b6b',
        subtle: '#fafafa',
        positive: '#0f6b3d',
        negative: '#9b1c1c',
        caution: '#8a5a00',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { DEFAULT: '4px' },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
};

export default config;
