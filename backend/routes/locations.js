const { Router } = require('express');

module.exports = function locationsRouter(db) {
  const router = Router();
  // List all locations with container count
  router.get('/', (req, res) => {
    const locations = db.prepare(`
      SELECT l.*, COUNT(c.id) AS container_count
      FROM locations l
      LEFT JOIN containers c ON c.location_id = l.id
      GROUP BY l.id
      ORDER BY l.name COLLATE NOCASE
    `).all();
    res.json(locations);
  });

  // Get single location with its containers (and item count per container)
  router.get('/:id', (req, res) => {
    const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const containers = db.prepare(`
      SELECT c.*, COUNT(i.id) AS item_count
      FROM containers c
      LEFT JOIN items i ON i.container_id = c.id
      WHERE c.location_id = ?
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE
    `).all(req.params.id);

    res.json({ ...location, containers });
  });

  // Create location
  router.post('/', (req, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = db.prepare(
      'INSERT INTO locations (name, description) VALUES (?, ?)'
    ).run(name.trim(), (description || '').trim());

    res.status(201).json({
      id: result.lastInsertRowid,
      name: name.trim(),
      description: (description || '').trim(),
      container_count: 0,
    });
  });

  // Update location
  router.put('/:id', (req, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    db.prepare(
      'UPDATE locations SET name = ?, description = ? WHERE id = ?'
    ).run(name.trim(), (description || '').trim(), req.params.id);

    res.json({ id: Number(req.params.id), name: name.trim(), description: (description || '').trim() });
  });

  // Delete location (cascades to containers and items)
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  return router;
};
