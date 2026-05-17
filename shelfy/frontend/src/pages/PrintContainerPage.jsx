import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import ContainerQRCode from '../components/ContainerQRCode.jsx';

export default function PrintContainerPage() {
  const { token } = useParams();
  const [container, setContainer] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.containers.getByToken(token)
      .then(setContainer)
      .catch(() => setError('Container not found'));
  }, [token]);

  // Trigger print dialog once container data is ready
  useEffect(() => {
    if (container) window.print();
  }, [container]);

  const base = { fontFamily: 'sans-serif', padding: 32, textAlign: 'center' };

  if (error) return <div style={base}>{error}</div>;
  if (!container) return <div style={base}>Loading…</div>;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 6mm; }
          body { margin: 0; }
        }
      `}</style>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        gap: 12,
        padding: 24,
        boxSizing: 'border-box',
        background: '#fff',
        color: '#000',
      }}>
        <ContainerQRCode token={token} size={260} />
        <div style={{ fontSize: 22, fontWeight: 700 }}>{container.name}</div>
        {container.location_name && (
          <div style={{ fontSize: 14, color: '#555' }}>{container.location_name}</div>
        )}
      </div>
    </>
  );
}
