import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { BUILT_BY, ECOSYSTEM, HR_TEAM, PARENT, SITE, SOCIAL_GROUPS } from '../../config/site';
import { useConsent } from '../../store/ui.store';
import { Brand } from '../common/SiteChrome';

const Ext = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="row" style={{ '--gap': '4px', display: 'inline-flex' }}>
    {children} <ExternalLink size={11} aria-hidden="true" />
    <span className="sr-only">(opens in a new tab)</span>
  </a>
);

const ICON_PATHS = {
  linkedin: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11.5H3V9.75Zm6.5 0h3.8v1.6h.06c.53-1 1.82-2.05 3.75-2.05 4 0 4.74 2.63 4.74 6.05v5.9h-4v-5.23c0-1.25-.02-2.86-1.75-2.86-1.75 0-2.02 1.36-2.02 2.77v5.32h-4V9.75Z',
  youtube: 'M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.28 5 12 5 12 5s-6.28 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2C2 8.77 2 12 2 12s0 3.23.4 4.8a2.5 2.5 0 0 0 1.76 1.77C5.72 19 12 19 12 19s6.28 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77C22 15.23 22 12 22 12s0-3.23-.4-4.8ZM10 15V9l5.2 3-5.2 3Z',
  instagram: 'M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z',
};

function SocialIcon({ kind }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[kind]} />
    </svg>
  );
}

export function Footer() {
  const openSettings = useConsent((s) => s.openSettings);
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Brand sub={`by ${SITE.company}`} />
            <p className="small muted mt-2">
              {SITE.tagline}. Free for students — a {SITE.company} initiative to close the gap between academia and industry.
            </p>
            <p className="small muted">
              Powered by <Ext href={PARENT.url}>{SITE.poweredBy}</Ext>
            </p>
            <div className="social-circles">
              {SOCIAL_GROUPS.map((g) => (
                <a key={g.key} href={g.links[0].url} target="_blank" rel="noopener noreferrer" aria-label={`${SITE.company} on ${g.title} (opens in a new tab)`} title={`${SITE.company} on ${g.title}`}>
                  <SocialIcon kind={g.key} />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4>Platform</h4>
            <ul>
              <li><Link to="/roadmaps">Roadmap library</Link></li>
              <li><Link to="/register">Student sign up</Link></li>
              <li><Link to="/mentor-apply">Become a mentor</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/contact">Contact us</Link></li>
            </ul>
          </div>
          <div>
            <h4>Our portals</h4>
            <ul>
              {ECOSYSTEM.map((e) => (
                <li key={e.key}>
                  <Ext href={e.url}>{e.label}</Ext>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Legal & privacy</h4>
            <ul>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/cookies">Cookie Policy</Link></li>
              <li><button type="button" className="linklike" onClick={openSettings}>Cookie settings</button></li>
              <li><Link to="/privacy#your-rights">Delete my data</Link></li>
            </ul>
          </div>
          <div>
            <h4>Connect</h4>
            <ul>
              {SITE.email && <li><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>}
              {SITE.phone && <li><a href={`tel:${SITE.phone.replace(/\s/g, '')}`}>{SITE.phone}</a></li>}
              {SITE.address && <li className="muted small">{SITE.address}</li>}
              {SITE.social.map((s) => (
                <li key={s.url}><Ext href={s.url}>{s.label}</Ext></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="footer-grid footer-follow">
          {SOCIAL_GROUPS.map((g) => (
            <div key={g.key}>
              <h4>Follow us on {g.title}</h4>
              <ul>
                {g.links.map((l) => (
                  <li key={l.url}>
                    <Ext href={l.url}>{l.label}</Ext>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4>Meet our HR team</h4>
            <ul>
              {HR_TEAM.map((m) => (
                <li key={m.url}>
                  <Ext href={m.url}>{m.name}</Ext>
                  <span className="xs subtle"> · {m.role}</span>
                </li>
              ))}
            </ul>
            <p className="xs subtle mt-1 mb-0">Send a connection request to hear back on your posts.</p>
          </div>
        </div>
        <div className="footer-built">
          <h4>Built with care by</h4>
          <ul>
            {BUILT_BY.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
        <p className="xs mt-3 mb-0" style={{ color: 'rgba(255,255,255,0.66)', maxWidth: 900 }}>
          <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Disclaimer:</strong> CareerSaathi is a career-guidance platform, not an employer or
          recruiter, and does not guarantee admission, interviews or jobs. Opportunities link to their respective organisations — verify employers
          independently and never pay a fee to apply.
        </p>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {SITE.company}. All rights reserved. Powered by {SITE.poweredBy}
          </span>
          <span>
            Mental health support: {SITE.helpline.name} <a href={`tel:${SITE.helpline.number}`}>{SITE.helpline.number}</a> (free, 24×7)
          </span>
        </div>
      </div>
    </footer>
  );
}
