import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';

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

// Visual indicator that appears when pulling or refreshing
function PullIndicator({ pullDistance, refreshing }) {
  const THRESHOLD = 60;
  const visible = pullDistance > 4 || refreshing;
  if (!visible) return null;

  // Rotate the arrow 0→180° as the pull approaches threshold
  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const arrowRotation = progress * 180;

  // Position: emerge from just below the navbar as the user pulls
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

export default function ContainerDetailPage() {
  const { id } = useParams();
  const [container, setContainer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const fetchingRef = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.containers.get(id);
      setContainer(data);
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

  // Refetch when the tab/window regains focus (keeps data fresh across devices)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') load({ silent: true });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [load]);

  const refresh = useCallback(() => load({ silent: true }), [load]);
  const pullDistance = usePullToRefresh(refresh);

  async function handleCreate(data) {
    await api.items.create(data);
    load({ silent: true });
  }

  async function handleUpdate(itemId, data) {
    await api.items.update(itemId, data);
    load({ silent: true });
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await api.items.delete(item.id);
    load({ silent: true });
  }

  if (loading) return <div className="loading">Loading…</div>;
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
          <button className="btn btn-primary" onClick={() => setModal('add')}>
            <PlusIcon /> Add Item
          </button>
        </div>
      </div>

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
            <div key={item.id} className="item-card">
              <div className="item-info">
                <div className="item-name">{item.name}</div>
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
                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  title="Edit"
                  onClick={() => setModal({ edit: item })}
                >
                  <EditIcon />
                </button>
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
