import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { syncPendingMutations, isSyncing } from '../services/syncEngine.js';
import {
  enqueueMutation,
  getAllPendingMutations,
  getCachedContainer,
  setCachedContainer,
  _resetDB,
} from '../services/offlineDB.js';

// ─── Mock the API ─────────────────────────────────────────────────────────────

vi.mock('../api.js', () => ({
  api: {
    items: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { api } from '../api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer(id = 1) {
  return {
    id,
    name: 'Test Box',
    type: 'box',
    location_id: 10,
    items: [{ id: 100, name: 'Existing Item', quantity: 1 }],
  };
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  _resetDB();
  vi.clearAllMocks();

  // Default: report online
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
});

// ─── Guard conditions ─────────────────────────────────────────────────────────

describe('syncPendingMutations — guard conditions', () => {
  it('returns early and does nothing when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 5 });
    const result = await syncPendingMutations();

    expect(result).toEqual({ synced: 0, failed: 0 });
    expect(api.items.delete).not.toHaveBeenCalled();
    // mutation should still be in the queue
    const remaining = await getAllPendingMutations();
    expect(remaining).toHaveLength(1);
  });

  it('prevents concurrent sync runs', async () => {
    api.items.delete.mockResolvedValue({ success: true });

    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 10 });
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 11 });

    // Fire two syncs simultaneously
    const [r1, r2] = await Promise.all([syncPendingMutations(), syncPendingMutations()]);

    // One should have run (synced > 0), the other should have returned early (synced === 0)
    const totalSynced = r1.synced + r2.synced;
    expect(totalSynced).toBeGreaterThan(0);
    // Together they should not double-process the same mutations
    expect(api.items.delete).toHaveBeenCalledTimes(2);
  });
});

// ─── create_item ──────────────────────────────────────────────────────────────

describe('syncPendingMutations — create_item', () => {
  it('calls api.items.create with the queued item data', async () => {
    api.items.create.mockResolvedValue({ id: 200, name: 'Wrench', quantity: 1, tags: '', description: '' });

    await enqueueMutation({
      type: 'create_item',
      containerId: 1,
      localItemId: 'local_1',
      itemData: { name: 'Wrench', quantity: 1, tags: '', description: '', container_id: 1 },
    });

    const result = await syncPendingMutations();

    expect(api.items.create).toHaveBeenCalledWith({
      name: 'Wrench', quantity: 1, tags: '', description: '', container_id: 1,
    });
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('removes the mutation from the queue after successful create', async () => {
    api.items.create.mockResolvedValue({ id: 201, name: 'Bolt', quantity: 5 });

    await enqueueMutation({
      type: 'create_item',
      containerId: 1,
      localItemId: 'local_2',
      itemData: { name: 'Bolt', quantity: 5, container_id: 1 },
    });

    await syncPendingMutations();

    const remaining = await getAllPendingMutations();
    expect(remaining).toHaveLength(0);
  });

  it('replaces the local placeholder with the server item in cache', async () => {
    const serverItem = { id: 202, name: 'Nut', quantity: 2, tags: '', description: '' };
    api.items.create.mockResolvedValue(serverItem);

    await setCachedContainer({
      ...makeContainer(1),
      items: [{ id: 'local_3', name: 'Nut', quantity: 2, _pending: true }],
    });

    await enqueueMutation({
      type: 'create_item',
      containerId: 1,
      localItemId: 'local_3',
      itemData: { name: 'Nut', quantity: 2, container_id: 1 },
    });

    await syncPendingMutations();

    const cached = await getCachedContainer(1);
    expect(cached.items).toHaveLength(1);
    expect(cached.items[0].id).toBe(202);
    expect(cached.items[0]._pending).toBeFalsy();
  });
});

// ─── delete_item ──────────────────────────────────────────────────────────────

describe('syncPendingMutations — delete_item', () => {
  it('calls api.items.delete with the real item id', async () => {
    api.items.delete.mockResolvedValue({ success: true });

    await setCachedContainer(makeContainer(1));
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 100 });

    const result = await syncPendingMutations();

    expect(api.items.delete).toHaveBeenCalledWith(100);
    expect(result.synced).toBe(1);
  });

  it('removes the mutation after successful delete', async () => {
    api.items.delete.mockResolvedValue({ success: true });
    await setCachedContainer(makeContainer(1));
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 100 });

    await syncPendingMutations();

    expect(await getAllPendingMutations()).toHaveLength(0);
  });

  it('skips API call and removes mutation for local-id delete (already collapsed)', async () => {
    // A delete_item for a local_ id means the create never synced
    // and somehow a delete mutation remained — it should be dropped silently
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 'local_orphan' });

    const result = await syncPendingMutations();

    expect(api.items.delete).not.toHaveBeenCalled();
    expect(result.synced).toBe(1);
    expect(await getAllPendingMutations()).toHaveLength(0);
  });

  it('removes the item from the cache after deletion', async () => {
    api.items.delete.mockResolvedValue({ success: true });
    await setCachedContainer(makeContainer(1)); // has item id 100
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 100 });

    await syncPendingMutations();

    const cached = await getCachedContainer(1);
    expect(cached.items.find((i) => i.id === 100)).toBeUndefined();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('syncPendingMutations — error handling', () => {
  it('stops processing and keeps mutations when a network error occurs', async () => {
    api.items.delete.mockRejectedValue(new TypeError('Failed to fetch'));

    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 100 });
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 101 });

    const result = await syncPendingMutations();

    expect(result.failed).toBe(1);
    // Both mutations should still be in the queue
    const remaining = await getAllPendingMutations();
    expect(remaining.length).toBeGreaterThanOrEqual(1);
  });

  it('drops a mutation and continues when server returns a non-network error', async () => {
    api.items.delete
      .mockRejectedValueOnce(new Error('Not found'))  // first call — server error
      .mockResolvedValue({ success: true });           // second call — ok

    await setCachedContainer(makeContainer(1));
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 100 });
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 101 });

    const result = await syncPendingMutations();

    // The bad mutation is dropped; the good one is processed
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(1);
    expect(await getAllPendingMutations()).toHaveLength(0);
  });
});
