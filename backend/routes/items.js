const router = require('express').Router();
const db = require('../db');

// Create item
router.post('/', (req, res) => {
  const { name, description, quantity, tags, container_id } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!container_id) return res.status(400).json({ error: 'container_id is required' });

  const qty = Number(quantity) > 0 ? Number(quantity) : 1;

  const result = db.prepare(
    'INSERT INTO items (name, description, quantity, tags, container_id) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), (description || '').trim(), qty, (tags || '').trim(), container_id);

  res.status(201).json({
    id: result.lastInsertRowid,
    name: name.trim(),
    description: (description || '').trim(),
    quantity: qty,
    tags: (tags || '').trim(),
    container_id,
  });
});

// Update item
router.put('/:id', (req, res) => {
  const { name, description, quantity, tags } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const qty = Number(quantity) > 0 ? Number(quantity) : 1;

  db.prepare(
    'UPDATE items SET name = ?, description = ?, quantity = ?, tags = ? WHERE id = ?'
  ).run(name.trim(), (description || '').trim(), qty, (tags || '').trim(), req.params.id);

  res.json({
    id: Number(req.params.id),
    name: name.trim(),
    description: (description || '').trim(),
    quantity: qty,
    tags: (tags || '').trim(),
  });
});

// Delete item
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
