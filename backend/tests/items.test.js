const request = require('supertest');
const createApp = require('../app');
const { createTestDb } = require('./helpers');

let app;
let db;
let containerId;

beforeEach(async () => {
  db = createTestDb();
  app = createApp(db);

  // Seed a location + container that item tests can attach to
  const loc = (
    await request(app).post('/api/locations').send({ name: 'Test Room' })
  ).body;

  const container = (
    await request(app)
      .post('/api/containers')
      .send({ name: 'Test Box', location_id: loc.id })
  ).body;

  containerId = container.id;
});

afterEach(() => {
  db.close();
});

// ─── helpers ────────────────────────────────────────────────────────────────

function createItem(overrides = {}) {
  return request(app)
    .post('/api/items')
    .send({ name: 'Widget', quantity: 1, container_id: containerId, ...overrides });
}

// ─── POST /api/items ─────────────────────────────────────────────────────────

describe('POST /api/items', () => {
  it('creates an item and returns 201', async () => {
    const res = await createItem({ name: 'Hammer', description: 'Heavy', quantity: 2, tags: 'tools' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Hammer');
    expect(res.body.description).toBe('Heavy');
    expect(res.body.quantity).toBe(2);
    expect(res.body.tags).toBe('tools');
    expect(res.body.container_id).toBe(containerId);
    expect(res.body.id).toBeDefined();
  });

  it('defaults quantity to 1 when not provided', async () => {
    const res = await createItem({ name: 'Nail' });
    expect(res.body.quantity).toBe(1);
  });

  it('defaults quantity to 1 for zero or negative values', async () => {
    const res = await createItem({ name: 'Nail', quantity: 0 });
    expect(res.body.quantity).toBe(1);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ container_id: containerId });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when container_id is missing', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ name: 'Orphan Item' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/container_id/);
  });

  it('trims whitespace from name, description, and tags', async () => {
    const res = await createItem({ name: '  Wrench  ', description: '  heavy  ', tags: '  tools  ' });
    expect(res.body.name).toBe('Wrench');
    expect(res.body.description).toBe('heavy');
    expect(res.body.tags).toBe('tools');
  });
});

// ─── PUT /api/items/:id ──────────────────────────────────────────────────────

describe('PUT /api/items/:id', () => {
  it('updates all fields', async () => {
    const created = (await createItem({ name: 'Old', quantity: 1 })).body;

    const res = await request(app)
      .put(`/api/items/${created.id}`)
      .send({ name: 'New', description: 'desc', quantity: 5, tags: 'x,y' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New');
    expect(res.body.quantity).toBe(5);
    expect(res.body.tags).toBe('x,y');
  });

  it('persists the update to the database', async () => {
    const created = (await createItem({ name: 'Before' })).body;

    await request(app)
      .put(`/api/items/${created.id}`)
      .send({ name: 'After', quantity: 3 });

    const container = await request(app).get(`/api/containers/${containerId}`);
    const item = container.body.items.find((i) => i.id === created.id);
    expect(item.name).toBe('After');
    expect(item.quantity).toBe(3);
  });

  it('returns 400 when name is missing', async () => {
    const created = (await createItem()).body;
    const res = await request(app)
      .put(`/api/items/${created.id}`)
      .send({ quantity: 5 });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/items/:id ───────────────────────────────────────────────────

describe('DELETE /api/items/:id', () => {
  it('deletes the item', async () => {
    const created = (await createItem({ name: 'Disposable' })).body;

    const del = await request(app).delete(`/api/items/${created.id}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(created.id);
    expect(row).toBeUndefined();
  });

  it('removing an item does not affect other items in the container', async () => {
    const keep = (await createItem({ name: 'Keep Me' })).body;
    const del  = (await createItem({ name: 'Delete Me' })).body;

    await request(app).delete(`/api/items/${del.id}`);

    const container = await request(app).get(`/api/containers/${containerId}`);
    const ids = container.body.items.map((i) => i.id);
    expect(ids).toContain(keep.id);
    expect(ids).not.toContain(del.id);
  });
});
