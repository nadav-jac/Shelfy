const request = require('supertest');
const createApp = require('../app');
const { createTestDb } = require('./helpers');

let app;
let db;

beforeEach(() => {
  db = createTestDb();
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

// ─── helpers ────────────────────────────────────────────────────────────────

function createLocation(overrides = {}) {
  return request(app)
    .post('/api/locations')
    .send({ name: 'Kitchen', description: '', ...overrides });
}

// ─── GET /api/locations ──────────────────────────────────────────────────────

describe('GET /api/locations', () => {
  it('returns an empty array when there are no locations', async () => {
    const res = await request(app).get('/api/locations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns created locations with container_count', async () => {
    await createLocation({ name: 'Garage' });
    await createLocation({ name: 'Attic' });

    const res = await request(app).get('/api/locations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Sorted alphabetically
    expect(res.body[0].name).toBe('Attic');
    expect(res.body[1].name).toBe('Garage');
    expect(res.body[0].container_count).toBe(0);
  });
});

// ─── GET /api/locations/:id ──────────────────────────────────────────────────

describe('GET /api/locations/:id', () => {
  it('returns 404 for a non-existent id', async () => {
    const res = await request(app).get('/api/locations/999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns the location with its containers', async () => {
    const created = (await createLocation({ name: 'Cellar' })).body;

    await request(app)
      .post('/api/containers')
      .send({ name: 'Shelf A', type: 'shelf', location_id: created.id });

    const res = await request(app).get(`/api/locations/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Cellar');
    expect(res.body.containers).toHaveLength(1);
    expect(res.body.containers[0].name).toBe('Shelf A');
  });
});

// ─── POST /api/locations ─────────────────────────────────────────────────────

describe('POST /api/locations', () => {
  it('creates a location and returns 201', async () => {
    const res = await createLocation({ name: 'Pantry', description: 'Food storage' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Pantry');
    expect(res.body.description).toBe('Food storage');
    expect(res.body.id).toBeDefined();
  });

  it('trims whitespace from name and description', async () => {
    const res = await createLocation({ name: '  Pantry  ', description: '  stuff  ' });
    expect(res.body.name).toBe('Pantry');
    expect(res.body.description).toBe('stuff');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/locations').send({ description: 'no name' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when name is blank', async () => {
    const res = await request(app).post('/api/locations').send({ name: '   ' });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /api/locations/:id ──────────────────────────────────────────────────

describe('PUT /api/locations/:id', () => {
  it('updates name and description', async () => {
    const created = (await createLocation({ name: 'Old Name' })).body;

    const res = await request(app)
      .put(`/api/locations/${created.id}`)
      .send({ name: 'New Name', description: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.description).toBe('Updated');

    // Verify it persisted
    const fetched = await request(app).get(`/api/locations/${created.id}`);
    expect(fetched.body.name).toBe('New Name');
  });

  it('returns 400 when name is missing', async () => {
    const created = (await createLocation()).body;
    const res = await request(app)
      .put(`/api/locations/${created.id}`)
      .send({ description: 'no name' });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/locations/:id ───────────────────────────────────────────────

describe('DELETE /api/locations/:id', () => {
  it('deletes the location', async () => {
    const created = (await createLocation()).body;
    const del = await request(app).delete(`/api/locations/${created.id}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const fetched = await request(app).get(`/api/locations/${created.id}`);
    expect(fetched.status).toBe(404);
  });

  it('cascades: deletes containers and their items', async () => {
    const loc = (await createLocation()).body;

    const container = (
      await request(app).post('/api/containers').send({ name: 'Box', location_id: loc.id })
    ).body;

    await request(app)
      .post('/api/items')
      .send({ name: 'Screwdriver', container_id: container.id });

    await request(app).delete(`/api/locations/${loc.id}`);

    // Container should be gone
    const c = await request(app).get(`/api/containers/${container.id}`);
    expect(c.status).toBe(404);
  });
});
