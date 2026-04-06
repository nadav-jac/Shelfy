import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children, footer }) {
  const backdropRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
