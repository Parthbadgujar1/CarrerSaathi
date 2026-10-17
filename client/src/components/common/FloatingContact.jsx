import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Mail, MessageCircle, Phone, X } from 'lucide-react';
import { SITE } from '../../config/site';
import { useClickOutside } from '../../hooks';

/** Floating contact button with quick ways to reach the team (and wellbeing helpline). */
export function FloatingContact() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      {open && (
        <div className="contact-pop" role="dialog" aria-label="Contact options" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>Need help?</h2>
          <p className="small muted">We usually reply within 2 working days.</p>
          <div className="stack" style={{ '--gap': '8px' }}>
            <Link className="btn btn-primary btn-block" to="/contact" onClick={() => setOpen(false)}>
              <MessageCircle aria-hidden="true" /> Send us a message
            </Link>
            {SITE.email && (
              <a className="btn btn-block" href={`mailto:${SITE.email}`}>
                <Mail aria-hidden="true" /> {SITE.email}
              </a>
            )}
            {SITE.phone && (
              <a className="btn btn-block" href={`tel:${SITE.phone.replace(/\s/g, '')}`}>
                <Phone aria-hidden="true" /> {SITE.phone}
              </a>
            )}
            <a className="btn btn-ghost btn-block" href={`tel:${SITE.helpline.number}`}>
              <HeartPulse aria-hidden="true" /> {SITE.helpline.name} {SITE.helpline.number} (24×7)
            </a>
          </div>
        </div>
      )}
      <button
        type="button"
        className="fab fab-primary"
        aria-label={open ? 'Close contact options' : 'Contact us'}
        aria-expanded={open}
        title="Contact us"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
      </button>
    </div>
  );
}
