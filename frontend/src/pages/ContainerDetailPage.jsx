import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import ContainerQRCode from '../components/ContainerQRCode.jsx';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import {
  getCachedContainer,
  setCachedContainer,
  enqueueMutation,
  getPendingMutationsForContainer,
  removeMutation,
  removeCreateMutationForLocalItem,
  applyPendingMutations,
} from '../services/offlineDB.js';
import { syncPendingMutations } from '../services/syncEngine.js';

// ─── Item form ────────────────────────────────────────────────────────────────

function ItemForm({ initial, containerId, onSubmit, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [tags, setTags] = useState(initial?.tags || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    setLoading(true);
    try {
      await onSubmit({ name, description, quantity, tags, container_id: containerId });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-group">
        <label>Name *</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Winter jacket, HDMI cable"
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details"
          />
        </div>
        <div className="form-group" style={{ maxWidth: 90 }}>
          <label>Qty</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Tags <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(comma-separated)</span></label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. electronics, tools, seasonal"
        />
      </div>
      <div className="modal-footer" style={{ padding: 0 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving…' : initial ? 'Save' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
      <line x1="14" y1="14" x2="14" y2="14"/><line x1="17" y1="14" x2="17" y2="14"/>
      <line x1="20" y1="14" x2="20" y2="14"/><line x1="14" y1="17" x2="14" y2="17"/>
      <line x1="17" y1="17" x2="17" y2="17"/><line x1="20" y1="17" x2="20" y2="17"/>
      <line x1="14" y1="20" x2="14" y2="20"/><line x1="17" y1="20" x2="17" y2="20"/>
      <line x1="20" y1="20" x2="20" y2="20"/>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" opacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10"/>
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6"/>
      <path d="M2.5 22v-6h6"/>
      <path d="M22 13A10 10 0 0 1 4.4 16.6"/>
      <path d="M2 11A10 10 0 0 1 19.6 7.4"/>
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

// ─── Pull-to-refresh indicator ────────────────────────────────────────────────

function PullIndicator({ pullDistance, refreshing }) {
  const THRESHOLD = 60;
  const visible = pullDistance > 4 || refreshing;
  if (!visible) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const arrowRotation = progress * 180;
  const translateY = refreshing ? 12 : Math.min(pullDistance, THRESHOLD) * 0.6;

  return (
    <div
      className={`pull-indicator${refreshing ? ' refreshing' : ' pulling'}`}
      style={{ marginTop: translateY }}
    >
      {refreshing ? (
        <SpinnerIcon />
      ) : (
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: `rotate(${arrowRotation}deg)`, color: 'var(--primary)' }}
        >
          <line x1="12" y1="5" x2="12" y2="19"/>
          <polyline points="19 12 12 19 5 12"/>
        </svg>
      )}
    </div>
  );
}

// ─── Status bar (offline / pending sync) ─────────────────────────────────────

function StatusBar({ isOnline, fromCache, pendingCount, syncing, onSync }) {
  if (syncing) {
    return (
      <div className="offline-bar offline-bar-pending" role="status" aria-live="polite">
        <span className="offline-bar-icon"><SpinnerIcon /></span>
        <span>Syncing changes…</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="offline-bar offline-bar-offline" role="status" aria-live="polite">
        <span className="offline-bar-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
        </span>
        <span>Offline{fromCache ? ' — showing cached data' : ''}</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="offline-bar offline-bar-pending" role="status" aria-live="polite">
        <span className="offline-bar-icon"><SyncIcon /></span>
        <span>{pendingCount} pending change{pendingCount !== 1 ? 's' : ''}</span>
        <button className="btn btn-sm btn-ghost" onClick={onSync} style={{ marginLeft: 'auto' }}>
          Sync now
        </button>
      </div>
    );
  }

  return null;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ContainerDetailPage() {
  const { id } = useParams();
  const { state: navState } = useLocation();
  const isOnline = useOnlineStatus();

  const [container, setContainer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(navState?.openAdd ? 'add' : null);
  const [search, setSearch] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const fetchingRef = useRef(false);
  const syncingRef = useRef(false);

  // ─── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async ({ silent = false } = {}) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);

    let cacheMode = false;

    try {
      let data;

      if (navigator.onLine) {
        try {
          data = await api.containers.get(id);
          // Cache the clean server snapshot (no pending items mixed in)
          await setCachedContainer(data);
        } catch (fetchErr) {
          // Went offline during the request — fall back to cache
          const cached = await getCachedContainer(Number(id));
          if (cached) {
            data = cached;
            cacheMode = true;
          } else {
            throw fetchErr;
          }
        }
      } else {
        const cached = await getCachedContainer(Number(id));
        if (cached) {
          data = cached;
          cacheMode = true;
        } else {
          setError('offline-unavailable');
          return;
        }
      }

      // Merge any pending offline mutations on top of the snapshot
      const pending = await getPendingMutationsForContainer(Number(id));
      const mergedItems = applyPendingMutations(data.items, pending);

      setContainer({ ...data, items: mergedItems });
      setPendingCount(pending.length);
      setFromCache(cacheMode);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Refetch when the tab/window regains focus
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') load({ silent: true });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [load]);

  // Auto-sync + reload when connectivity is restored
  useEffect(() => {
    async function onOnline() {
      await syncPendingMutations();
      load({ silent: true });
    }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [load]);

  // ─── Pull-to-refresh ────────────────────────────────────────────────────────

  const refresh = useCallback(() => load({ silent: true }), [load]);
  const pullDistance = usePullToRefresh(refresh);

  // ─── Manual sync ────────────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncPendingMutations();
      await load({ silent: true });
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [load]);

  // ─── Item actions ────────────────────────────────────────────────────────────

  async function handleCreate(data) {
    if (navigator.onLine) {
      await api.items.create(data);
      load({ silent: true });
    } else {
      // Offline path: optimistic insert with temporary id
      const localItemId = `local_${Date.now()}`;
      const localItem = {
        id: localItemId,
        name: data.name.trim(),
        description: (data.description || '').trim(),
        quantity: Number(data.quantity) > 0 ? Number(data.quantity) : 1,
        tags: (data.tags || '').trim(),
        container_id: Number(id),
        _pending: true,
      };

      await enqueueMutation({
        type: 'create_item',
        containerId: Number(id),
        localItemId,
        itemData: {
          name: localItem.name,
          description: localItem.description,
          quantity: localItem.quantity,
          tags: localItem.tags,
          container_id: localItem.container_id,
        },
      });

      setContainer((prev) => ({ ...prev, items: [...prev.items, localItem] }));
      setPendingCount((c) => c + 1);
    }
  }

  async function handleUpdate(itemId, data) {
    // Edit is online-only — the form will surface the network error if offline
    await api.items.update(itemId, data);
    load({ silent: true });
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;

    if (navigator.onLine) {
      await api.items.delete(item.id);
      load({ silent: true });
    } else {
      const isLocal = String(item.id).startsWith('local_');

      if (isLocal) {
        // Offline-created item deleted before it synced — collapse into a no-op
        const removed = await removeCreateMutationForLocalItem(item.id);
        if (removed) setPendingCount((c) => c - 1);
      } else {
        // Real server item — queue a delete for when we reconnect
        await enqueueMutation({
          type: 'delete_item',
          containerId: Number(id),
          itemId: item.id,
        });
        setPendingCount((c) => c + 1);
      }

      setContainer((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== item.id),
      }));
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="loading">Loading…</div>;

  if (error === 'offline-unavailable') {
    return (
      <div className="page">
        <div className="offline-unavailable">
          <div className="offline-unavailable-icon">📡</div>
          <h3>Not available offline</h3>
          <p>This container hasn't been loaded before. Connect to a network to open it.</p>
        </div>
      </div>
    );
  }

  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!container) return null;

  const filteredItems = search.trim()
    ? container.items.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.description.toLowerCase().includes(search.toLowerCase()) ||
          item.tags.toLowerCase().includes(search.toLowerCase())
      )
    : container.items;

  return (
    <main className="page">
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <nav className="breadcrumb">
        <Link to="/">Locations</Link>
        <span className="breadcrumb-sep">/</span>
        <Link to={`/locations/${container.location_id}`}>{container.location_name}</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{container.name}</span>
      </nav>

      <div className="page-header">
        <div>
          <h1>{container.name}</h1>
          <p>
            <span className="badge" style={{ marginRight: 6 }}>{container.type}</span>
            {container.description && container.description}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`btn btn-ghost btn-icon btn-refresh${refreshing ? ' spinning' : ''}`}
            onClick={refresh}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshIcon />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => setModal('qr')} title="Show QR" aria-label="Show QR">
            <QrIcon />
          </button>
          <button className="btn btn-primary" onClick={() => setModal('add')}>
            <PlusIcon /> Add Item
          </button>
        </div>
      </div>

      <StatusBar
        isOnline={isOnline}
        fromCache={fromCache}
        pendingCount={pendingCount}
        syncing={syncing}
        onSync={handleSync}
      />

      {container.items.length > 4 && (
        <div className="search-bar" style={{ marginBottom: 16 }}>
          <SearchMiniIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter items…"
          />
          {search && (
            <button
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              onClick={() => setSearch('')}
            >
              &times;
            </button>
          )}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">&#x1F4CB;</div>
          {container.items.length === 0 ? (
            <>
              <h3>No items yet</h3>
              <p>Add items stored in this container.</p>
            </>
          ) : (
            <>
              <h3>No matches</h3>
              <p>Try a different search term.</p>
            </>
          )}
        </div>
      ) : (
        <div className="item-list">
          {filteredItems.map((item) => (
            <div key={item.id} className={`item-card${item._pending ? ' item-card-pending' : ''}`}>
              <div className="item-info">
                <div className="item-name">
                  {item.name}
                  {item._pending && (
                    <span className="badge-pending" title="Waiting to sync">
                      <PendingIcon /> pending
                    </span>
                  )}
                </div>
                {item.description && <div className="item-desc">{item.description}</div>}
                {item.tags && (
                  <div className="item-tags">
                    {item.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="qty-badge">x{item.quantity}</div>
              <div className="item-actions">
                {!item._pending && (
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    title="Edit"
                    onClick={() => setModal({ edit: item })}
                  >
                    <EditIcon />
                  </button>
                )}
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  title="Delete"
                  onClick={() => handleDelete(item)}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && (
        <Modal title="Add Item" onClose={() => setModal(null)}>
          <ItemForm
            containerId={Number(id)}
            onSubmit={handleCreate}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.edit && (
        <Modal title="Edit Item" onClose={() => setModal(null)}>
          <ItemForm
            initial={modal.edit}
            containerId={Number(id)}
            onSubmit={(data) => handleUpdate(modal.edit.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal === 'qr' && (
        <Modal title={`QR — ${container.name}`} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <ContainerQRCode token={container.qr_token} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              Scan to open and add items to this container.
            </p>
            <button
              className="btn btn-ghost"
              onClick={() => window.open(`/print/container/${container.qr_token}`, '_blank')}
            >
              Print QR
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function SearchMiniIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
