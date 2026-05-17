const express = require('express');

/**
 * Creates and returns the Express app wired to the given db instance.
 * Keeping this separate from server.js lets tests inject an in-memory DB
 * without touching the production database file.
 */
function createApp(db) {
  const app = express();
  app.use(express.json());

  app.use('/api/locations',  require('./routes/locations')(db));
  app.use('/api/containers', require('./routes/containers')(db));
  app.use('/api/items',      require('./routes/items')(db));
  app.use('/api/search',     require('./routes/search')(db));

  // API error handler — must have 4 params for Express to treat it as error middleware
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
