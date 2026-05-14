import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  getCachedContainer,
  setCachedContainer,
  enqueueMutation,
  getAllPendingMutations,
  getPendingMutationsForContainer,
  removeMutation,
  removeCreateMutationForLocalItem,
  applyPendingMutations,
  _resetDB,
} from '../services/offlineDB.js';

// Give each test a completely fresh IDBFactory so stores do not bleed between tests.
// _resetDB() clears the cached DB handle so the next getDB() call opens the new factory.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDB();
});

// ─── Container cache ──────────────────────────────────────────────────────────

describe('getCachedContainer', () => {
  it('returns undefined when container has never been cached', async () => {
    const result = await getCachedContainer(999);
    expect(result).toBeUndefined();
  });
});

describe('setCachedContainer / getCachedContainer', () => {
  it('stores and retrieves a container by id', async () => {
    const container = { id: 1, name: 'Box', type: 'box', location_id: 10, items: [] };
    await setCachedContainer(container);
    const cached = await getCachedContainer(1);
    expect(cached).toMatchObject(container);
  });

  it('adds a cachedAt timestamp', async () => {
    const before = Date.now();
    await setCachedContainer({ id: 2, name: 'Shelf', type: 'shelf', location_id: 10, items: [] });
    const cached = await getCachedContainer(2);
    expect(cached.cachedAt).toBeGreaterThanOrEqual(before);
    expect(cached.cachedAt).toBeLessThanOrEqual(Date.now());
  });

  it('overwrites an existing cached container', async () => {
    await setCachedContainer({ id: 3, name: 'Old', type: 'box', location_id: 10, items: [] });
    await setCachedContainer({ id: 3, name: 'New', type: 'shelf', location_id: 10, items: [] });
    const cached = await getCachedContainer(3);
    expect(cached.name).toBe('New');
    expect(cached.type).toBe('shelf');
  });
});

// ─── Pending mutations ────────────────────────────────────────────────────────

describe('enqueueMutation / getAllPendingMutations', () => {
  it('returns an empty array when no mutations are queued', async () => {
    const all = await getAllPendingMutations();
    expect(all).toEqual([]);
  });

  it('enqueues a mutation and returns it', async () => {
    await enqueueMutation({
      type: 'create_item',
      containerId: 5,
      localItemId: 'local_1',
      itemData: { name: 'Hammer', quantity: 1, container_id: 5 },
    });
    const all = await getAllPendingMutations();
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe('create_item');
    expect(all[0].containerId).toBe(5);
    expect(all[0].localItemId).toBe('local_1');
  });

  it('preserves insertion order across multiple mutations', async () => {
    await enqueueMutation({ type: 'create_item', containerId: 1, localItemId: 'local_a', itemData: {} });
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 42 });
    await enqueueMutation({ type: 'create_item', containerId: 1, localItemId: 'local_b', itemData: {} });

    const all = await getAllPendingMutations();
    expect(all).toHaveLength(3);
    expect(all[0].localItemId).toBe('local_a');
    expect(all[1].type).toBe('delete_item');
    expect(all[2].localItemId).toBe('local_b');
  });

  it('adds a timestamp to each mutation', async () => {
    const before = Date.now();
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 7 });
    const all = await getAllPendingMutations();
    expect(all[0].timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('getPendingMutationsForContainer', () => {
  it('returns only mutations for the requested container', async () => {
    await enqueueMutation({ type: 'create_item', containerId: 10, localItemId: 'local_1', itemData: {} });
    await enqueueMutation({ type: 'create_item', containerId: 20, localItemId: 'local_2', itemData: {} });
    await enqueueMutation({ type: 'delete_item', containerId: 10, itemId: 5 });

    const forTen = await getPendingMutationsForContainer(10);
    expect(forTen).toHaveLength(2);
    expect(forTen.every((m) => m.containerId === 10)).toBe(true);
  });

  it('returns empty array when no mutations exist for that container', async () => {
    await enqueueMutation({ type: 'delete_item', containerId: 99, itemId: 1 });
    const result = await getPendingMutationsForContainer(55);
    expect(result).toEqual([]);
  });
});

describe('removeMutation', () => {
  it('removes the mutation with the given localId', async () => {
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 100 });
    const before = await getAllPendingMutations();
    const localId = before[0].localId;

    await removeMutation(localId);

    const after = await getAllPendingMutations();
    expect(after).toHaveLength(0);
  });

  it('does not affect other mutations when removing one', async () => {
    await enqueueMutation({ type: 'create_item', containerId: 1, localItemId: 'a', itemData: {} });
    await enqueueMutation({ type: 'create_item', containerId: 1, localItemId: 'b', itemData: {} });

    const all = await getAllPendingMutations();
    await removeMutation(all[0].localId);

    const remaining = await getAllPendingMutations();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].localItemId).toBe('b');
  });
});

describe('removeCreateMutationForLocalItem', () => {
  it('removes the matching create_item mutation and returns true', async () => {
    await enqueueMutation({
      type: 'create_item',
      containerId: 1,
      localItemId: 'local_abc',
      itemData: {},
    });

    const removed = await removeCreateMutationForLocalItem('local_abc');
    expect(removed).toBe(true);

    const remaining = await getAllPendingMutations();
    expect(remaining).toHaveLength(0);
  });

  it('returns false when no matching mutation exists', async () => {
    const removed = await removeCreateMutationForLocalItem('local_nonexistent');
    expect(removed).toBe(false);
  });

  it('only removes the create mutation, not other mutations', async () => {
    await enqueueMutation({ type: 'create_item', containerId: 1, localItemId: 'local_x', itemData: {} });
    await enqueueMutation({ type: 'delete_item', containerId: 1, itemId: 5 });

    await removeCreateMutationForLocalItem('local_x');

    const remaining = await getAllPendingMutations();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe('delete_item');
  });
});

// ─── applyPendingMutations (pure helper) ─────────────────────────────────────

describe('applyPendingMutations', () => {
  const baseItems = [
    { id: 1, name: 'Hammer', quantity: 1 },
    { id: 2, name: 'Screwdriver', quantity: 3 },
  ];

  it('returns items unchanged when there are no mutations', () => {
    const result = applyPendingMutations(baseItems, []);
    expect(result).toEqual(baseItems);
  });

  it('injects a pending create_item with _pending: true', () => {
    const mutations = [
      {
        type: 'create_item',
        localItemId: 'local_99',
        itemData: { name: 'Nail', quantity: 10 },
      },
    ];
    const result = applyPendingMutations(baseItems, mutations);
    expect(result).toHaveLength(3);
    const nail = result.find((i) => i.id === 'local_99');
    expect(nail).toBeDefined();
    expect(nail._pending).toBe(true);
    expect(nail.name).toBe('Nail');
  });

  it('does not duplicate a pending item already in the list', () => {
    const itemsWithLocal = [
      ...baseItems,
      { id: 'local_99', name: 'Nail', quantity: 10, _pending: true },
    ];
    const mutations = [{ type: 'create_item', localItemId: 'local_99', itemData: { name: 'Nail' } }];
    const result = applyPendingMutations(itemsWithLocal, mutations);
    expect(result.filter((i) => i.id === 'local_99')).toHaveLength(1);
  });

  it('removes an item via delete_item mutation', () => {
    const mutations = [{ type: 'delete_item', itemId: 1 }];
    const result = applyPendingMutations(baseItems, mutations);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('processes create then delete in order', () => {
    const mutations = [
      { type: 'create_item', localItemId: 'local_5', itemData: { name: 'Tape' } },
      { type: 'delete_item', itemId: 'local_5' },
    ];
    const result = applyPendingMutations(baseItems, mutations);
    // Should end up with just the original 2 items
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.id === 'local_5')).toBeUndefined();
  });
});
