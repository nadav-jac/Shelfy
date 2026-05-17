require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const db = require('./db');
const createApp = require('./app');

const app = createApp(db);

// Stable QR redirect for standalone (non-HA) mode.
// QR codes always encode /shelfy/scan/container/<token> — a path that is
// stable regardless of how the server is deployed.
// In HA mode the shelfy_redirect custom integration intercepts this path
// on HA's HTTP server before it ever reaches Express.
// In standalone mode Express handles it here and redirects to the React route.
app.get('/shelfy/scan/container/:token', (req, res) => {
  res.redirect(`/scan/container/${req.params.token}`);
});

// Serve the built frontend static assets (JS, CSS, icons, etc.)
// index: false ensures index.html is never served directly here —
// it always goes through the catch-all below so window.__BASE__ gets injected.
const distPath = path.join(__dirname, '../frontend/dist');
app.use(require('express').static(distPath, { index: false }));

// Catch-all: let React Router handle client-side routes.
// Inject window.__BASE__ (the HA ingress path prefix, e.g. "/api/hassio_ingress/<token>")
// so the frontend can fix routing and API calls when served behind ingress.
// Empty string when accessed directly (local dev or direct port).
const htmlTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');

app.get('*', (req, res) => {
  const ingressPath = req.headers['x-ingress-path'] || '';
  const injected = htmlTemplate.replace(
    '<head>',
    `<head><script>window.__BASE__=${JSON.stringify(ingressPath)};</script>`,
  );
  res.type('html').send(injected);
});

const PORT = process.env.PORT || 43127;
app.listen(PORT, () => {
  console.log(`Shelfy running on http://localhost:${PORT}`);
});
