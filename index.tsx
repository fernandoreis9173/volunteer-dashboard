import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Service Worker Registration ---
// This is the most robust way to register a service worker.
// It waits until the entire page (including all dependent resources) has finished loading.
// This prevents the "document is in an invalid state" error, which is a race condition
// that can occur if registration is attempted while the page is still being parsed or
// if it conflicts with client-side routing.
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = new URL('/sw.js', window.location.origin);
      navigator.serviceWorker.register(swUrl.href)
        .then(registration => {
          console.log('Service Worker registered successfully with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  } else {
    console.warn('Service Workers are not supported by this browser.');
  }
};

registerServiceWorker();


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