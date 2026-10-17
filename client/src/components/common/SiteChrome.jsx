/**
 * Small always-available site helpers: brand, theme toggle, skip link,
 * scroll progress, back-to-top, offline notice, route progress.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Monitor, Moon, Sun, WifiOff } from 'lucide-react';
import { resolvedTheme, useTheme } from '../../store/ui.store';
import { useOnlineStatus, useScrollY } from '../../hooks';
import { Menu } from '../ui';

/** The "C" mark — same shape as public/favicon.svg (open ring + highlight dot). */
export function BrandMarkSvg() {
  return (
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M42.96 21.04A15.5 15.5 0 1 0 42.96 42.96" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <circle cx="47" cy="32" r="5.5" fill="var(--brand-glow)" />
    </svg>
  );
}

export function Brand({ to = '/', sub }) {
  return (
    <Link to={to} className="brand" aria-label="CareerSaathi home">
      <span className="brand-mark" aria-hidden="true">
        <BrandMarkSvg />
      </span>
      <span>
        Career<span className="wm-accent">Saathi</span>
        {sub && <small>{sub}</small>}
      </span>
    </Link>
  );
}

export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to main content
    </a>
  );
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [, force] = useState(0);
  // Re-render when the OS theme changes while "system" is selected.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const fn = () => force((n) => n + 1);
    mq?.addEventListener?.('change', fn);
    return () => mq?.removeEventListener?.('change', fn);
  }, []);
  const Icon = resolvedTheme(theme) === 'dark' ? Moon : Sun;
  return (
    <Menu
      width={170}
      trigger={(props) => (
        <button type="button" className="icon-btn" aria-label={`Theme: ${theme}. Change theme`} title="Change theme" {...props}>
          <Icon aria-hidden="true" />
        </button>
      )}
    >
      {THEME_OPTIONS.map((o) => (
        <button key={o.value} type="button" role="menuitem" className="menu-item" onClick={() => setTheme(o.value)} aria-current={theme === o.value}>
          <o.icon aria-hidden="true" />
          <span className="flex-1">{o.label}</span>
          {theme === o.value && <span className="xs muted">✓</span>}
        </button>
      ))}
    </Menu>
  );
}

export function ScrollProgress() {
  const y = useScrollY();
  const max = typeof document !== 'undefined' ? document.documentElement.scrollHeight - window.innerHeight : 1;
  const pct = max > 0 ? Math.min(1, y / max) : 0;
  return <div className="scroll-progress" style={{ transform: `scaleX(${pct})` }} aria-hidden="true" />;
}

export function BackToTop() {
  const y = useScrollY();
  if (y < 600) return null;
  return (
    <button
      type="button"
      className="fab"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('main')?.focus({ preventScroll: true });
      }}
    >
      <ArrowUp aria-hidden="true" />
    </button>
  );
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff aria-hidden="true" /> You are offline. Changes will fail until you reconnect.
    </div>
  );
}

export function RouteProgress() {
  return <div className="route-progress" role="progressbar" aria-label="Loading page" />;
}

export function LastUpdated({ date }) {
  return (
    <span className="updated">
      Last updated: <time dateTime={date}>{new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
    </span>
  );
}
