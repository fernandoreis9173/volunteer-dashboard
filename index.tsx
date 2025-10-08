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

// This alternative registration pattern aims to avoid race conditions with the 'load' event.
// If the document is still loading, we wait for the 'load' event.
// If it's already 'interactive' or 'complete', we register immediately.
if (document.readyState === 'loading') {
  window.addEventListener('load', performServiceWorkerRegistration);
} else {
  performServiceWorkerRegistration();
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
