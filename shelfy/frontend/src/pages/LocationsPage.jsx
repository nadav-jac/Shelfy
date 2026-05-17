import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';

function pluralize(n, word) { return `${n} ${n === 1 ? word : word + 's'}`; }

function LocationForm({ initial, onSubmit, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    setLoading(true);
    try {
      await onSubmit({ name, description });
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
          placeholder="e.g. Kitchen, Living Room, Garage"
        />
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

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
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
      const data = await api.locations.list();
      setLocations(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    await api.locations.create(data);
    load({ silent: true });
  }

  async function handleUpdate(id, data) {
    await api.locations.update(id, data);
    load({ silent: true });
  }

  async function handleDelete(location) {
    const msg = location.container_count > 0
      ? `Delete "${location.name}" and all its containers and items?`
      : `Delete "${location.name}"?`;
    if (!confirm(msg)) return;
    await api.locations.delete(location.id);
    load({ silent: true });
  }

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <main className="page">
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {error && <div className="error-banner">{error}</div>}

      <div className="page-header">
        <div>
          <h1>My Locations</h1>
          <p>Rooms, areas, and places where things are stored</p>
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
            <PlusIcon /> Add Location
          </button>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">&#x1F3E0;</div>
          <h3>No locations yet</h3>
          <p>Add a room or area to get started.</p>
        </div>
      ) : (
        <div className="grid">
          {locations.map((loc) => (
            <div key={loc.id} className="card">
              <Link to={`/locations/${loc.id}`} className="card-link">
                <div className="card-body">
                  <div className="type-icon" style={{ background: '#eff6ff' }}>
                    <RoomIcon />
                  </div>
                  <div className="card-title">{loc.name}</div>
                  {loc.description && <div className="card-desc">{loc.description}</div>}
                  <div className="card-meta">
                    <span className="badge badge-gray">
                      {pluralize(loc.container_count, 'container')}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="card-body" style={{ paddingTop: 0 }}>
                <div className="card-actions" style={{ opacity: 1, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    title="Edit"
                    onClick={() => setModal({ edit: loc })}
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="btn btn-danger btn-sm btn-icon"
                    title="Delete"
                    onClick={() => handleDelete(loc)}
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
        <Modal title="New Location" onClose={() => setModal(null)}>
          <LocationForm onSubmit={handleCreate} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modal?.edit && (
        <Modal title="Edit Location" onClose={() => setModal(null)}>
          <LocationForm
            initial={modal.edit}
            onSubmit={(data) => handleUpdate(modal.edit.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </main>
  );
}

function RoomIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
