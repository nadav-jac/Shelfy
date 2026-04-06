require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());

// API routes
app.use('/api/locations', require('./routes/locations'));
app.use('/api/containers', require('./routes/containers'));
app.use('/api/items', require('./routes/items'));
app.use('/api/search', require('./routes/search'));

// API error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Serve the built frontend
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));

// Catch-all: let React Router handle client-side routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 43127;
app.listen(PORT, () => {
  console.log(`Shelfy running on http://localhost:${PORT}`);
});
