import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './App.css';

// window.__BASE__ is injected by the Express server when running behind
// Home Assistant ingress (e.g. "/api/hassio_ingress/<token>").
//
// Problem: the PWA service worker caches index.html and can serve it for
// navigation requests without going to the server — meaning the server's
// injection never runs and window.__BASE__ is undefined. This causes a
// blank page because React Router's basename is wrong.
//
// Fix: whenever the server does inject __BASE__, persist it to localStorage.
// On subsequent loads (including SW-served ones), read it back as a fallback.
// The ingress token is stable per add-on install, so localStorage is safe.
if (window.__BASE__ !== undefined) {
  localStorage.setItem('shelfy-base', window.__BASE__);
}
const basename = window.__BASE__ ?? localStorage.getItem('shelfy-base') ?? '/';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
