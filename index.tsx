
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// This function handles the service worker registration.
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    // Register the service worker. Using a relative path to avoid origin mismatch errors.
    navigator.serviceWorker.register('sw.js').then(registration => {
      console.log('Service Worker registered: ', registration);
    }).catch(registrationError => {
      console.log('Service Worker registration failed: ', registrationError);
    });
  }
};

// We wrap the registration in a 'load' event listener.
// This ensures the page is fully loaded, preventing the "document is in an invalid state" error.
window.addEventListener('load', registerServiceWorker);

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