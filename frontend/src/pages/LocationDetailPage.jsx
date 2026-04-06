import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';

const CONTAINER_TYPES = ['cabinet', 'shelf', 'box', 'drawer', 'bag', 'other'];

const TYPE_ICONS = {
  cabinet: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="12" y1="3" x2="12" y2="21"/>
    </svg>
  ),
  shelf: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="16" width="22" height="3" rx="1"/>
      <rect x="1" y="10" width="22" height="3" rx="1"/>
      <rect x="3" y="4" width="2" height="6" rx="1"/>
      <rect x="19" y="4" width="2" height="6" rx="1"/>
    </svg>
  ),
  box: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  drawer: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <circle cx="12" cy="9" r="1" fill="#3b82f6"/>
      <circle cx="12" cy="16" r="1" fill="#3b82f6"/>
    </svg>
  ),
  bag: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  other: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
};

function ContainerForm({ initial, locationId, onSubmit, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'box');
  const [description, setDescription] = useState(initial?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    setLoading(true);
    try {
      await onSubmit({ name, type, description, location_id: locationId });
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
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label>Name *</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Top Shelf, Blue Box"
          />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {CONTAINER_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes"
          rows={2}
        />
      </div>
      <div className="modal-footer" style={{ padding: 0 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving…' : initial ? 'Save' : 'Create'}
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10"/>
        </svg>
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

export default function LocationDetailPage() {
  const { id } = useParams();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const fetchingRef = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.locations.get(id);
      setLocation(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
    await api.containers.create(data);
    load({ silent: true });
  }

  async function handleUpdate(containerId, data) {
    await api.containers.update(containerId, data);
    load({ silent: true });
  }

  async function handleDelete(container) {
    const msg = container.item_count > 0
      ? `Delete "${container.name}" and all ${container.item_count} items inside?`
      : `Delete "${container.name}"?`;
    if (!confirm(msg)) return;
    await api.containers.delete(container.id);
    load({ silent: true });
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!location) return null;

  return (
    <main className="page">
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <nav className="breadcrumb">
        <Link to="/">Locations</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{location.name}</span>
      </nav>

      <div className="page-header">
        <div>
          <h1>{location.name}</h1>
          {location.description && <p>{location.description}</p>}
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
            <PlusIcon /> Add Container
          </button>
        </div>
      </div>

      {location.containers.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">&#x1F4E6;</div>
          <h3>No containers yet</h3>
          <p>Add a shelf, box, or cabinet to this location.</p>
        </div>
      ) : (
        <div className="grid">
          {location.containers.map((container) => (
            <div key={container.id} className="card">
              <Link to={`/containers/${container.id}`} className="card-link">
                <div className="card-body">
                  <div className="type-icon">
                    {TYPE_ICONS[container.type] || TYPE_ICONS.other}
                  </div>
                  <div className="card-title">{container.name}</div>
                  {container.description && <div className="card-desc">{container.description}</div>}
                  <div className="card-meta">
                    <span className="badge badge-gray">
                      {container.item_count === 1 ? '1 item' : `${container.item_count} items`}
                    </span>
                    <span className="badge">{container.type}</span>
                  </div>
                </div>
              </Link>
              <div className="card-body" style={{ paddingTop: 0 }}>
                <div className="card-actions" style={{ opacity: 1, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    title="Edit"
                    onClick={() => setModal({ edit: container })}
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="btn btn-danger btn-sm btn-icon"
                    title="Delete"
                    onClick={() => handleDelete(container)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && (
        <Modal title="New Container" onClose={() => setModal(null)}>
          <ContainerForm
            locationId={Number(id)}
            onSubmit={handleCreate}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {modal?.edit && (
        <Modal title="Edit Container" onClose={() => setModal(null)}>
          <ContainerForm
            initial={modal.edit}
            locationId={Number(id)}
            onSubmit={(data) => handleUpdate(modal.edit.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </main>
  );
}
