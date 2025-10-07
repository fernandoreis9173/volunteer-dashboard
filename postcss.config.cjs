// No arquivo: postcss.config.cjs
module.exports = {
  plugins: {
    // CORRIGIDO: Usa o plugin correto para PostCSS
    '@tailwindcss/postcss': {}, 
    autoprefixer: {},
  },
};