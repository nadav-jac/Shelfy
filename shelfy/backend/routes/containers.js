const { Router } = require('express');
const crypto = require('crypto');

module.exports = function containersRouter(db) {
  const router = Router();
  const validTypes = ['cabinet', 'shelf', 'box', 'drawer', 'bag', 'other'];

  // Get container by QR token
  router.get('/qr/:token', (req, res) => {
    const container = db.prepare(`
      SELECT c.*, l.name AS location_name
      FROM containers c
      JOIN locations l ON l.id = c.location_id
      WHERE c.qr_token = ?
    `).get(req.params.token);
    if (!container) return res.status(404).json({ error: 'Container not found' });

    const items = db.prepare(`
      SELECT * FROM items WHERE container_id = ? ORDER BY name COLLATE NOCASE
    `).all(container.id);

    res.json({ ...container, items });
  });

  // Get single container with its items
  router.get('/:id', (req, res) => {
    const container = db.prepare(`
      SELECT c.*, l.name AS location_name
      FROM containers c
      JOIN locations l ON l.id = c.location_id
      WHERE c.id = ?
    `).get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });

    const items = db.prepare(`
      SELECT * FROM items WHERE container_id = ? ORDER BY name COLLATE NOCASE
    `).all(req.params.id);

    res.json({ ...container, items });
  });

  // Create container
  router.post('/', (req, res) => {
    const { name, type, description, location_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!location_id) return res.status(400).json({ error: 'location_id is required' });

    const containerType = validTypes.includes(type) ? type : 'box';
    const qrToken = crypto.randomBytes(16).toString('hex');

    const result = db.prepare(
      'INSERT INTO containers (name, type, description, location_id, qr_token) VALUES (?, ?, ?, ?, ?)'
    ).run(name.trim(), containerType, (description || '').trim(), location_id, qrToken);

    res.status(201).json({
      id: result.lastInsertRowid,
      name: name.trim(),
      type: containerType,
      description: (description || '').trim(),
      location_id,
      qr_token: qrToken,
      item_count: 0,
    });
  });

  // Update container
  router.put('/:id', (req, res) => {
    const { name, type, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const containerType = validTypes.includes(type) ? type : 'box';

    db.prepare(
      'UPDATE containers SET name = ?, type = ?, description = ? WHERE id = ?'
    ).run(name.trim(), containerType, (description || '').trim(), req.params.id);

    res.json({ id: Number(req.params.id), name: name.trim(), type: containerType, description: (description || '').trim() });
  });

  // Delete container (cascades to items)
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM containers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  return router;
};
