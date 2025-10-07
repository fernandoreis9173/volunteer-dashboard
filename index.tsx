
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

if ('serviceWorker' in navigator) {
  // Constrói uma URL absoluta para o service worker usando a origem da página
  // para garantir que seja registrado corretamente, mesmo em ambientes com URLs complexas.
  const swUrl = new URL('/sw.js', window.location.origin);
  navigator.serviceWorker.register(swUrl.href).then(registration => {
    console.log('Service Worker registered: ', registration);
  }).catch(registrationError => {
    console.log('Service Worker registration failed: ', registrationError);
  });
}

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