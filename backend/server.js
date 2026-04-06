require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const db = require('./db');
const createApp = require('./app');

const app = createApp(db);

// Serve the built frontend
const distPath = path.join(__dirname, '../frontend/dist');
app.use(require('express').static(distPath));

// Catch-all: let React Router handle client-side routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 43127;
app.listen(PORT, () => {
  console.log(`Shelfy running on http://localhost:${PORT}`);
});
