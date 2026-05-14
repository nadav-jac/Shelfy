import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getContainerFromCatalog } from '../services/offlineDB.js';

export default function ScanContainerPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);

  useEffect(() => {
    async function resolve() {
      try {
        // Happy path — server resolves the token
        const container = await api.containers.getByToken(token);
        navigate(`/containers/${container.id}`, { replace: true, state: { openAdd: true } });
      } catch {
        // Network unavailable or server error — try the local catalog
        const entry = await getContainerFromCatalog(token).catch(() => null);
        if (entry) {
          // Container was previously synced; navigate and let ContainerDetailPage
          // serve the cached snapshot (or show its own offline-unavailable state).
          navigate(`/containers/${entry.id}`, { replace: true, state: { openAdd: true } });
        } else {
          setOfflineUnavailable(true);
        }
      }
    }

    resolve();
  }, [token, navigate]);

  if (offlineUnavailable) {
    return (
      <div className="page">
        <div className="offline-unavailable">
          <div className="offline-unavailable-icon">📡</div>
          <h3>Not available offline</h3>
          <p>This container hasn't been synced to this device. Open the app while connected to a network to enable offline scanning.</p>
        </div>
      </div>
    );
  }

  return <div className="loading">Loading…</div>;
}
