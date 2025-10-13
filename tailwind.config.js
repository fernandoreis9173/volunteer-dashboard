import { defineConfig } from 'tailwindcss';

export default defineConfig({
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}', // todos os arquivos React
  ],
  theme: {
    extend: {},
  },
  plugins: [],
});
