import React from 'react';
import ReactDOM from 'react-dom/client';

// Suppress Supabase debug logs in development
if (process.env.NODE_ENV === 'development') {
  const originalLog = console.log;
  console.log = function (...args: any[]) {
    // Filter out Supabase search endpoint logs
    if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Search endpoint requested')) {
      return;
    }
    originalLog.apply(console, args);
  };
}

// Fix passive event listener warnings
// This makes all touchstart, touchmove, wheel, and mousewheel listeners passive by default
(function () {
  if (typeof EventTarget !== "undefined") {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type: string, listener: any, options?: any) {
      const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];
      if (passiveEvents.includes(type)) {
        if (typeof options === 'object' && options !== null) {
          if (options.passive === undefined) {
            options.passive = true;
          }
        } else {
          options = { passive: true, capture: typeof options === 'boolean' ? options : false };
        }
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
  }
})();

import App from './App';

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  // Defer registration until after the page has loaded to avoid race conditions
  // and ensure the document is in a valid state.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
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