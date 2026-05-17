const request = require('supertest');
const createApp = require('../app');
const { createTestDb } = require('./helpers');

let app;
let db;
let locationId;

beforeEach(async () => {
  db = createTestDb();
  app = createApp(db);

  // Seed a location that container tests can attach to
  const res = await request(app)
    .post('/api/locations')
    .send({ name: 'Test Room' });
  locationId = res.body.id;
});

afterEach(() => {
  db.close();
});

// ─── helpers ────────────────────────────────────────────────────────────────

function createContainer(overrides = {}) {
  return request(app)
    .post('/api/containers')
    .send({ name: 'Box', type: 'box', description: '', location_id: locationId, ...overrides });
}

// ─── GET /api/containers/:id ─────────────────────────────────────────────────

describe('GET /api/containers/:id', () => {
  it('returns 404 for a non-existent id', async () => {
    const res = await request(app).get('/api/containers/999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns the container with location_name and items array', async () => {
    const created = (await createContainer({ name: 'Tool Box' })).body;

    const res = await request(app).get(`/api/containers/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Tool Box');
    expect(res.body.location_name).toBe('Test Room');
    expect(res.body.items).toEqual([]);
  });

  it('includes items sorted alphabetically', async () => {
    const container = (await createContainer()).body;

    await request(app).post('/api/items').send({ name: 'Zebra', container_id: container.id });
    await request(app).post('/api/items').send({ name: 'Apple', container_id: container.id });

    const res = await request(app).get(`/api/containers/${container.id}`);
    expect(res.body.items[0].name).toBe('Apple');
    expect(res.body.items[1].name).toBe('Zebra');
  });
});

// ─── GET /api/containers/qr/:token ──────────────────────────────────────────

describe('GET /api/containers/qr/:token', () => {
  it('returns 404 for an invalid token', async () => {
    const res = await request(app).get('/api/containers/qr/doesnotexist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns container with location_name and items array', async () => {
    const created = (await createContainer({ name: 'Tool Box' })).body;

    const res = await request(app).get(`/api/containers/qr/${created.qr_token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.name).toBe('Tool Box');
    expect(res.body.location_name).toBe('Test Room');
    expect(res.body.items).toEqual([]);
  });

  it('includes items sorted alphabetically', async () => {
    const container = (await createContainer()).body;

    await request(app).post('/api/items').send({ name: 'Zebra', container_id: container.id });
    await request(app).post('/api/items').send({ name: 'Apple', container_id: container.id });

    const res = await request(app).get(`/api/containers/qr/${container.qr_token}`);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].name).toBe('Apple');
    expect(res.body.items[1].name).toBe('Zebra');
  });

  it('items are linked to the correct container', async () => {
    const a = (await createContainer({ name: 'Container A' })).body;
    const b = (await createContainer({ name: 'Container B' })).body;

    await request(app).post('/api/items').send({ name: 'Item in A', container_id: a.id });

    const res = await request(app).get(`/api/containers/qr/${b.qr_token}`);
    expect(res.body.items).toHaveLength(0);
  });
});

// ─── POST /api/containers ────────────────────────────────────────────────────

describe('POST /api/containers', () => {
  it('creates a container and returns 201', async () => {
    const res = await createContainer({ name: 'Shelf', type: 'shelf', description: 'Top shelf' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Shelf');
    expect(res.body.type).toBe('shelf');
    expect(res.body.description).toBe('Top shelf');
    expect(res.body.location_id).toBe(locationId);
  });

  it('defaults to type "box" for unknown types', async () => {
    const res = await createContainer({ type: 'spaceship' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('box');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/containers')
      .send({ location_id: locationId });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when location_id is missing', async () => {
    const res = await request(app)
      .post('/api/containers')
      .send({ name: 'Orphan Box' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/location_id/);
  });
});

// ─── PUT /api/containers/:id ─────────────────────────────────────────────────

describe('PUT /api/containers/:id', () => {
  it('updates name, type, and description', async () => {
    const created = (await createContainer({ name: 'Old', type: 'box' })).body;

    const res = await request(app)
      .put(`/api/containers/${created.id}`)
      .send({ name: 'New', type: 'cabinet', description: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New');
    expect(res.body.type).toBe('cabinet');
    expect(res.body.description).toBe('Updated');
  });

  it('returns 400 when name is missing', async () => {
    const created = (await createContainer()).body;
    const res = await request(app)
      .put(`/api/containers/${created.id}`)
      .send({ type: 'shelf' });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/containers/:id ──────────────────────────────────────────────

describe('DELETE /api/containers/:id', () => {
  it('deletes the container', async () => {
    const created = (await createContainer()).body;

    const del = await request(app).delete(`/api/containers/${created.id}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const fetched = await request(app).get(`/api/containers/${created.id}`);
    expect(fetched.status).toBe(404);
  });

  it('cascades: deletes items inside the container', async () => {
    const container = (await createContainer()).body;

    const item = (
      await request(app)
        .post('/api/items')
        .send({ name: 'Hammer', container_id: container.id })
    ).body;

    await request(app).delete(`/api/containers/${container.id}`);

    // Item row should be gone — verify via the items table directly
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(item.id);
    expect(row).toBeUndefined();
  });
});
