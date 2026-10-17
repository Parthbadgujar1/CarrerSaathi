import { useCallback, useRef, useState } from 'react';
import { useClickOutside } from '../../hooks';

/**
 * Dropdown menu with keyboard support (Escape closes, arrow keys move).
 * `trigger` is a render function receiving button props.
 */
export function Menu({ trigger, children, align = 'right', width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      ref.current?.querySelector('[aria-haspopup]')?.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...(ref.current?.querySelectorAll('[role="menuitem"]') || [])];
      const idx = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }} onKeyDown={onKeyDown}>
      {trigger({ 'aria-haspopup': 'menu', 'aria-expanded': open, onClick: () => setOpen((o) => !o) })}
      {open && (
        <div
          className="menu"
          role="menu"
          style={{ [align]: 0, top: 'calc(100% + 6px)', width }}
          onClick={(e) => {
            if (e.target.closest('[role="menuitem"]')) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
