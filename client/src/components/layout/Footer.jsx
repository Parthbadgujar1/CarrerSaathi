import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { ECOSYSTEM, PARENT, SITE } from '../../config/site';
import { useConsent } from '../../store/ui.store';
import { Brand } from '../common/SiteChrome';

const Ext = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="row" style={{ '--gap': '4px', display: 'inline-flex' }}>
    {children} <ExternalLink size={11} aria-hidden="true" />
    <span className="sr-only">(opens in a new tab)</span>
  </a>
);

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
            <p className="small muted mb-0">
              Powered by <Ext href={PARENT.url}>{SITE.poweredBy}</Ext>
            </p>
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
