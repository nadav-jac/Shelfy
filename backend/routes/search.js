const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json([]);

  const like = `%${query}%`;

  const results = db.prepare(`
    SELECT
      i.id,
      i.name,
      i.description,
      i.quantity,
      i.tags,
      c.id   AS container_id,
      c.name AS container_name,
      c.type AS container_type,
      l.id   AS location_id,
      l.name AS location_name
    FROM items i
    JOIN containers c ON c.id = i.container_id
    JOIN locations  l ON l.id = c.location_id
    WHERE i.name LIKE ? OR i.description LIKE ? OR i.tags LIKE ?
    ORDER BY i.name COLLATE NOCASE
    LIMIT 100
  `).all(like, like, like);

  res.json(results);
});

module.exports = router;
