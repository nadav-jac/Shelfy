require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const db = require('./db');
const createApp = require('./app');

const app = createApp(db);

// Serve the built frontend static assets (JS, CSS, icons, etc.)
// index: false ensures index.html is never served directly here —
// it always goes through the catch-all below so window.__BASE__ gets injected.
const distPath = path.join(__dirname, '../frontend/dist');
app.use(require('express').static(distPath, { index: false }));

// Catch-all: let React Router handle client-side routes.
// Inject window.__BASE__ so the frontend can adapt to Home Assistant ingress.
// When running locally (no ingress), X-Ingress-Path is absent and __BASE__ is "".
app.get('*', (req, res) => {
  const ingressPath = req.headers['x-ingress-path'] || '';
  const html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
  const injected = html.replace(
    '<head>',
    `<head><script>window.__BASE__=${JSON.stringify(ingressPath)};</script>`,
  );
  res.type('html').send(injected);
});

const PORT = process.env.PORT || 43127;
app.listen(PORT, () => {
  console.log(`Shelfy running on http://localhost:${PORT}`);
});
