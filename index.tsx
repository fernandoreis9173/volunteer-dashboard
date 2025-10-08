import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Service Worker Registration ---

const performServiceWorkerRegistration = () => {
  if ('serviceWorker' in navigator) {
    // We create the URL relative to the origin to avoid any pathing issues.
    const swUrl = new URL('/sw.js', window.location.origin);
    navigator.serviceWorker.register(swUrl.href)
      .then(registration => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  } else {
    console.warn('Service Workers are not supported by this browser.');
  }
};

// This is the definitive, most robust pattern for Service Worker registration.
// It addresses the race condition where the 'load' event might fire *before*
// this script gets to run, which is a common cause for the "invalid state" error.
if (document.readyState === 'complete') {
  // If the page is already fully loaded, we can register the service worker immediately.
  performServiceWorkerRegistration();
} else {
  // Otherwise, we wait for the 'load' event to fire.
  window.addEventListener('load', performServiceWorkerRegistration);
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