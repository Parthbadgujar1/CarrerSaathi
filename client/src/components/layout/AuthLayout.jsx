import { Link } from 'react-router-dom';
import { BadgeCheck, Compass, HeartPulse, MessagesSquare } from 'lucide-react';
import { Brand, ThemeToggle } from '../common/SiteChrome';
import { SITE } from '../../config/site';

const POINTS = [
  { icon: Compass, text: 'Roadmaps for every degree — curated or AI-generated' },
  { icon: BadgeCheck, text: 'Industry readiness score with a clear next step' },
  { icon: MessagesSquare, text: 'Mentors, communities and live sessions' },
  { icon: HeartPulse, text: 'Wellbeing check-ins, focus timer and support' },
];

export function AuthLayout({ children, wide }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside on-brand" aria-hidden="true">
        <Brand sub="by Skill NexGen" />
        <div>
          <h2 style={{ fontSize: '1.6rem', maxWidth: 420 }}>Your companion from classroom to career.</h2>
          <ul className="list-plain stack mt-2" style={{ '--gap': '14px' }}>
            {POINTS.map((p) => (
              <li key={p.text} className="row" style={{ '--gap': '12px' }}>
                <span className="stat-icon">
                  <p.icon />
                </span>
                <span className="muted">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="xs subtle mb-0">Free for students · No ads · Your data stays yours</p>
      </aside>
      <div className="auth-main">
        <div className="row-between">
          <span className="mobile-auth-brand">
            <Brand />
          </span>
          <ThemeToggle />
        </div>
        <main id="main" tabIndex={-1} className={`auth-card ${wide ? 'wide' : ''}`} style={{ outline: 'none' }}>
          {children}
        </main>
        <p className="xs subtle center mb-0">
          <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/contact">Help</Link> · © {SITE.company}
        </p>
      </div>
    </div>
  );
}
