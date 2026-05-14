import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './App.css';

// window.__BASE__ is injected by the Express server when running behind
// Home Assistant ingress (e.g. "/api/hassio_ingress/<token>").
// Falls back to "/" for direct / local development access.
const basename = window.__BASE__ || '/';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
