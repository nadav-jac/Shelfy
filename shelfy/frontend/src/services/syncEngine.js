/**
 * syncEngine.js — Replays pending offline mutations against the live API.
 *
 * Design:
 *  - Processes mutations sequentially in insertion order (stable, predictable)
 *  - A module-level flag prevents concurrent sync runs
 *  - Network errors halt processing and leave remaining mutations in the queue
 *  - Server-side errors (4xx) are logged and the offending mutation is dropped
 *    so one bad mutation cannot block the rest of the queue
 */

import { api } from '../api.js';
import {
  getAllPendingMutations,
  removeMutation,
  getCachedContainer,
  setCachedContainer,
} from './offlineDB.js';

let _syncing = false;

/** Returns true while a sync run is in progress. */
export function isSyncing() {
  return _syncing;
}

/**
 * Processes all pending mutations in order.
 * Returns { synced: number, failed: number }.
 *
 * Callers should reload data from the server after a successful sync run
 * to surface the authoritative server state.
 */
export async function syncPendingMutations() {
  if (_syncing || !navigator.onLine) return { synced: 0, failed: 0 };

  _syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const mutations = await getAllPendingMutations();

    for (const mutation of mutations) {
      // Stop mid-queue if we lose connectivity during the sync run
      if (!navigator.onLine) break;

      try {
        if (mutation.type === 'create_item') {
          await _syncCreate(mutation);
          synced++;
        } else if (mutation.type === 'delete_item') {
          await _syncDelete(mutation);
          synced++;
        } else {
          // Unknown mutation type — drop it to avoid blocking the queue
          console.warn('[sync] Unknown mutation type, dropping:', mutation);
          await removeMutation(mutation.localId);
        }
      } catch (err) {
        if (_isNetworkError(err)) {
          // Lost connectivity — abort and retry next time
          failed++;
          break;
        }
        // Server rejected the request (4xx / 5xx) — log and drop
        console.warn('[sync] Mutation failed (server error), dropping:', mutation, err.message);
        await removeMutation(mutation.localId);
        failed++;
      }
    }
  } finally {
    _syncing = false;
  }

  return { synced, failed };
}

// ─── Mutation handlers ────────────────────────────────────────────────────────

async function _syncCreate(mutation) {
  const newItem = await api.items.create(mutation.itemData);

  // Update the cached container: replace the local placeholder with the real item
  const cached = await getCachedContainer(mutation.containerId);
  if (cached) {
    const items = cached.items.map((item) =>
      item.id === mutation.localItemId ? { ...newItem } : item
    );
    await setCachedContainer({ ...cached, items });
  }

  await removeMutation(mutation.localId);
}

async function _syncDelete(mutation) {
  const itemId = mutation.itemId;

  if (String(itemId).startsWith('local_')) {
    // This item was created offline and never reached the server.
    // The corresponding create_item mutation should have been collapsed, but
    // if somehow a stale delete mutation remains, just drop it safely.
    await removeMutation(mutation.localId);
    return;
  }

  await api.items.delete(itemId);

  // Keep the cache consistent (item was already removed from UI)
  const cached = await getCachedContainer(mutation.containerId);
  if (cached) {
    const items = cached.items.filter((item) => item.id !== itemId);
    await setCachedContainer({ ...cached, items });
  }

  await removeMutation(mutation.localId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _isNetworkError(err) {
  // fetch() throws a TypeError when the network is unavailable
  return err instanceof TypeError;
}
