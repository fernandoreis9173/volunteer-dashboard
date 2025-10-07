import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App.tsx';
import './src/index.css'; 

const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('Service Worker registered: ', registration);
    }).catch(err => {
      console.error('Falha ao registrar SW: ', err);
    });
  }
};

window.addEventListener('load', registerServiceWorker);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
