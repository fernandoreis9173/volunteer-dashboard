import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// CSS Tailwind
import './index.css';

// CSS do FullCalendar
import '@fullcalendar/core/main.css';
import '@fullcalendar/daygrid/main.css';
import '@fullcalendar/timegrid/main.css';
import '@fullcalendar/interaction/main.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
