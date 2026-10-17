import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Info, RefreshCw } from 'lucide-react';
import { colorFor, initials } from '../../lib/format';
import { getErrorMessage } from '../../lib/http';
import { Button } from './Button';

export function Spinner({ label = 'Loading', large }) {
  return (
    <span role="status" className="row" style={{ justifyContent: 'center' }}>
      <span className={`spinner ${large ? 'spinner-lg' : ''}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="empty" style={{ minHeight: 280, justifyContent: 'center' }} role="status" aria-live="polite">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <span className="small muted">{label}</span>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, radius, className = '', style }) {
  return <span className={`skeleton ${className}`} style={{ display: 'block', width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card" aria-hidden="true">
      <Skeleton width="40%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={`${90 - i * 12}%`} height={12} style={{ marginTop: 12 }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon aria-hidden="true" />
      </div>
      {title && <h3>{title}</h3>}
      {children && <div className="small" style={{ maxWidth: 420 }}>{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "We couldn't load this" }) {
  return (
    <div className="empty" role="alert">
      <div className="empty-icon" style={{ color: 'var(--danger)', background: 'var(--danger-soft)' }}>
        <AlertTriangle aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <div className="small">{getErrorMessage(error)}</div>
      {onRetry && (
        <Button size="sm" icon={RefreshCw} onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}

const ALERT_ICONS = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info };
export function Alert({ type = 'info', title, children, className = '' }) {
  const Icon = ALERT_ICONS[type];
  return (
    <div className={`alert alert-${type} ${className}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div>
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Badge({ tone, children, icon: Icon }) {
  return (
    <span className={`badge ${tone ? `badge-${tone}` : ''}`}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Avatar({ name = '', size = 36 }) {
  return (
    <span className="avatar" style={{ '--size': `${size}px`, background: colorFor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ value = 0, label, small }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`progress ${small ? 'progress-sm' : ''}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progress'}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function ProgressRing({ value = 0, size = 128, stroke = 10, label, sublabel }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 70 ? 'var(--success)' : v >= 40 ? 'var(--primary)' : 'var(--warning)';
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label || 'Score'}: ${Math.round(v)} out of 100`}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          style={{ transition: 'stroke-dashoffset 0.8s var(--ease)' }}
        />
      </svg>
      <div className="ring-label" aria-hidden="true">
        <div>
          <div className="ring-value">{Math.round(v)}</div>
          {sublabel && <div className="xs muted">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}

/** Copy-to-clipboard with visual confirmation and a fallback for older browsers. */
export function CopyButton({ text, label = 'Copy', size = 'sm', variant = 'default' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size={size} variant={variant} icon={copied ? Check : Copy} onClick={copy} aria-live="polite">
      {copied ? 'Copied!' : label}
    </Button>
  );
}

export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    e.currentTarget.parentElement.children[next]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.icon && <t.icon size={16} aria-hidden="true" />}
          {t.label}
          {t.count ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="small muted">
        Showing {from}–{to} of {total}
      </span>
      <div className="row" style={{ '--gap': '6px' }}>
        <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="small" aria-current="page">
          Page {page} of {pages}
        </span>
        <Button size="sm" iconRight={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="stat flex-1">
          <span className="label">{label}</span>
          <span className="value">{value ?? '—'}</span>
          {hint && <span className="xs subtle">{hint}</span>}
        </div>
        {Icon && (
          <span className="stat-icon" style={tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})` } : undefined}>
            <Icon aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
