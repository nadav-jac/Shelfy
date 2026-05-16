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
// Inject runtime config so the frontend can adapt to Home Assistant ingress:
//   window.__BASE__    — ingress path prefix (e.g. "/api/hassio_ingress/<token>")
//                        used to fix routing and API calls under ingress.
//   window.__QR_BASE__ — direct-port base URL for QR codes (e.g. "http://homeassistant.local:43127")
//                        QR codes must NOT use the ingress URL because HA ingress
//                        requires an authenticated session — phones scanning a
//                        physical label would get a 401.
const QR_BASE_URL = process.env.QR_BASE_URL || '';
const htmlTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');

app.get('*', (req, res) => {
  const ingressPath = req.headers['x-ingress-path'] || '';
  const injected = htmlTemplate.replace(
    '<head>',
    `<head><script>window.__BASE__=${JSON.stringify(ingressPath)};window.__QR_BASE__=${JSON.stringify(QR_BASE_URL)};</script>`,
  );
  res.type('html').send(injected);
});

const PORT = process.env.PORT || 43127;
app.listen(PORT, () => {
  console.log(`Shelfy running on http://localhost:${PORT}`);
});
