import React from 'react'; 
import * as _ from 'react/jsx-runtime';
import App from './App.tsx';

// Verifica se o Service Worker é suportado
if ('serviceWorker' in navigator) {
  // O evento 'DOMContentLoaded' é o ponto ideal para iniciar o registro.
  // Ele dispara assim que o DOM é carregado, o que resolve o erro "invalid state".
  window.addEventListener('DOMContentLoaded', () => {
    const swUrl = new URL('/sw.js', window.location.origin);
    
    // Registra o Service Worker
    navigator.serviceWorker.register(swUrl.href).then(registration => {
      console.log('Service Worker registered: ', registration);
    }).catch(registrationError => {
      console.error('Service Worker registration failed: ', registrationError);
    });
  });
}

// INÍCIO DO MONTAGEM DO REACT:
// Esta parte do código deve ficar fora de qualquer listener de evento.
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);