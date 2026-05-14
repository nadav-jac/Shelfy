/**
 * offlineDB.js — IndexedDB persistence layer for offline support.
 *
 * Stores:
 *   containers      — cached container + items snapshots from the server
 *   pendingMutations — queued create_item / delete_item operations
 */

const DB_NAME = 'shelfy-offline';
const DB_VERSION = 2;

let _db = null;

async function getDB() {
  if (_db) return _db;
  _db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = ({ target: { result: db } }) => {
      // v1 stores
      if (!db.objectStoreNames.contains('containers')) {
        db.createObjectStore('containers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pendingMutations')) {
        // autoIncrement gives each mutation a stable localId for ordering / removal
        db.createObjectStore('pendingMutations', { keyPath: 'localId', autoIncrement: true });
      }
      // v2 stores
      if (!db.objectStoreNames.contains('containerCatalog')) {
        // Lightweight catalog for offline QR-token → container-id resolution.
        // Populated whenever the app loads data that includes container info.
        db.createObjectStore('containerCatalog', { keyPath: 'qr_token' });
      }
    };

    req.onsuccess = ({ target: { result: db } }) => resolve(db);
    req.onerror = ({ target: { error } }) => reject(error);
  });
  return _db;
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Container cache ──────────────────────────────────────────────────────────

/**
 * Returns the cached container object (including items), or undefined if not cached.
 */
export async function getCachedContainer(id) {
  const db = await getDB();
  const tx = db.transaction('containers', 'readonly');
  return idbRequest(tx.objectStore('containers').get(Number(id)));
}

/**
 * Stores a full container snapshot (container fields + items array) in the cache.
 * Adds a cachedAt timestamp so callers can show staleness if desired.
 */
export async function setCachedContainer(container) {
  const db = await getDB();
  const tx = db.transaction('containers', 'readwrite');
  return idbRequest(tx.objectStore('containers').put({ ...container, cachedAt: Date.now() }));
}

// ─── Pending mutations ────────────────────────────────────────────────────────

/**
 * Enqueues a pending mutation. The localId is auto-assigned by IndexedDB.
 *
 * Mutation shapes:
 *   create_item: { type, containerId, localItemId, itemData: { name, description, quantity, tags, container_id } }
 *   delete_item: { type, containerId, itemId }
 */
export async function enqueueMutation(mutation) {
  const db = await getDB();
  const tx = db.transaction('pendingMutations', 'readwrite');
  return idbRequest(tx.objectStore('pendingMutations').add({ ...mutation, timestamp: Date.now() }));
}

/** Returns all pending mutations in insertion order (ascending localId). */
export async function getAllPendingMutations() {
  const db = await getDB();
  const tx = db.transaction('pendingMutations', 'readonly');
  return idbRequest(tx.objectStore('pendingMutations').getAll());
}

/** Returns pending mutations for a specific container (preserves insertion order). */
export async function getPendingMutationsForContainer(containerId) {
  const all = await getAllPendingMutations();
  return all.filter((m) => m.containerId === containerId);
}

/** Removes a pending mutation by its auto-assigned localId. */
export async function removeMutation(localId) {
  const db = await getDB();
  const tx = db.transaction('pendingMutations', 'readwrite');
  return idbRequest(tx.objectStore('pendingMutations').delete(localId));
}

/**
 * Removes a create_item mutation whose localItemId matches the given id.
 * Used to collapse create+delete pairs for items that never reached the server.
 * Returns true if a matching mutation was found and removed.
 */
export async function removeCreateMutationForLocalItem(localItemId) {
  const all = await getAllPendingMutations();
  const match = all.find((m) => m.type === 'create_item' && m.localItemId === localItemId);
  if (match) {
    await removeMutation(match.localId);
    return true;
  }
  return false;
}

// ─── Container catalog (offline QR resolution) ────────────────────────────────

/**
 * Entry shape: { qr_token, id, name, type, location_id, location_name }
 * Stored whenever the app fetches data that includes container metadata.
 */
export async function upsertContainerInCatalog(entry) {
  const db = await getDB();
  const tx = db.transaction('containerCatalog', 'readwrite');
  return idbRequest(tx.objectStore('containerCatalog').put(entry));
}

/**
 * Bulk-upsert an array of catalog entries in a single transaction.
 * Best-effort: errors are silently swallowed by callers via `.catch(() => {})`.
 */
export async function upsertContainersCatalog(entries) {
  if (!entries || entries.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('containerCatalog', 'readwrite');
    const store = tx.objectStore('containerCatalog');
    for (const entry of entries) store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Looks up a container by its qr_token. Returns the catalog entry or undefined.
 */
export async function getContainerFromCatalog(qr_token) {
  const db = await getDB();
  const tx = db.transaction('containerCatalog', 'readonly');
  return idbRequest(tx.objectStore('containerCatalog').get(qr_token));
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

/**
 * Applies a list of pending mutations to a clean item list (from server or cache).
 * Returns the merged item list that should be shown in the UI.
 *
 * - create_item mutations inject a local item with _pending: true
 * - delete_item mutations remove items (both real and local-id deletions)
 */
export function applyPendingMutations(items, mutations) {
  let result = [...items];

  for (const m of mutations) {
    if (m.type === 'create_item') {
      const alreadyPresent = result.some((i) => i.id === m.localItemId);
      if (!alreadyPresent) {
        result = [
          ...result,
          {
            ...m.itemData,
            id: m.localItemId,
            _pending: true,
          },
        ];
      }
    } else if (m.type === 'delete_item') {
      result = result.filter((i) => i.id !== m.itemId);
    }
  }

  return result;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Resets the cached DB reference. Call between tests to get a fresh DB. */
export function _resetDB() {
  _db = null;
}
