import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const swUrl = `${window.location.origin}/sw.js`;
      const registration = await navigator.serviceWorker.register(swUrl);
      console.log('Service Worker registered successfully with scope:', registration.scope);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
} else {
    console.warn('Service Workers are not supported by this browser.');
}


// --- React App Mounting ---
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