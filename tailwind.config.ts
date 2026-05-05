import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0E0E14',
        surface:  '#16161F',
        surface2: '#1C1C28',
        border:   '#2A2A3D',
        accent:   '#8B5CF6',
        accent2:  '#A78BFA',
        text1:    '#F0EEFF',
        text2:    '#9D9DB8',
        text3:    '#5C5C7A',
        success:  '#34D399',
        danger:   '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
