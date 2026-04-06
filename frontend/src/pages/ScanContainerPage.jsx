import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function ScanContainerPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    api.containers.getByToken(token).then((container) => {
      navigate(`/containers/${container.id}`, { replace: true, state: { openAdd: true } });
    }).catch(() => {
      navigate('/', { replace: true });
    });
  }, [token, navigate]);

  return <div className="loading">Loading…</div>;
}
