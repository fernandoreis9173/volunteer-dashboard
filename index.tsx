import React, { StrictMode } from 'react'; // 1. CORREÇÃO: Importa StrictMode
import ReactDOM from 'react-dom/client'; // 2. CORREÇÃO: Importa ReactDOM
import App from './App.tsx'; // 3. CORREÇÃO: Caminho do arquivo (se for .tsx)

// Verifica se o Service Worker é suportado
if ('serviceWorker' in navigator) {
  // O evento 'DOMContentLoaded' é o ponto ideal para iniciar o registro.
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
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <StrictMode> // 4. CORREÇÃO: Usa o nome limpo do componente importado
    <App />
  </StrictMode>
);