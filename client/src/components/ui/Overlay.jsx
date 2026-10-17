import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks';
import { Button, IconButton } from './Button';
import { TextField } from './Field';

/** Accessible modal dialog: focus trap, Escape to close, backdrop click, scroll lock. */
export function Modal({ open, onClose, title, children, footer, size, labelledBy }) {
  const titleId = useId();
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className={`modal ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy || titleId}>
        {title && (
          <div className="modal-header">
            <h2 id={titleId}>{title}</h2>
            <IconButton icon={X} label="Close dialog" onClick={onClose} />
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children }) {
  const titleId = useId();
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', paddingBottom: 12, borderBottom: '1px solid var(--border)', zIndex: 2 }}>
          <h2 id={titleId}>{title}</h2>
          <IconButton icon={X} label="Close panel" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

/**
 * Confirmation dialog for destructive / irreversible actions.
 * `confirmText` forces the user to type a phrase (no accidental clicks — and no dark patterns:
 * the cancel option is always equally visible).
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger, loading, confirmText, children }) {
  const [typed, setTyped] = useState('');
  const blocked = confirmText && typed.trim().toLowerCase() !== confirmText.toLowerCase();
  const close = () => {
    setTyped('');
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={blocked}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '14px' }}>
        {danger && (
          <div className="alert alert-warning">
            <AlertTriangle aria-hidden="true" />
            <div>{message}</div>
          </div>
        )}
        {!danger && message && <p className="muted mb-0">{message}</p>}
        {children}
        {confirmText && (
          <TextField
            label={`Type "${confirmText}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            data-autofocus
          />
        )}
      </div>
    </Modal>
  );
}
