import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarDays, CircleDashed, TrendingDown, TrendingUp } from 'lucide-react';
import { adminApi, studentApi } from '../../services/api';
import { CardSkeleton, ErrorState, ProgressRing } from '../ui';

const PERIODS = [
  { value: 'week', label: 'Weekly', long: 'last 7 days' },
  { value: 'fortnight', label: 'Fortnightly', long: 'last 14 days' },
  { value: 'month', label: 'Monthly', long: 'last 30 days' },
];

const VIEWS = [
  { value: 'bars', label: 'Bars', icon: BarChart3 },
  { value: 'rings', label: 'Circular', icon: CircleDashed },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
];

const METRICS = {
  student: [
    { key: 'steps', label: 'Roadmap steps', color: 'var(--primary)' },
    { key: 'checkins', label: 'Wellness check-ins', color: 'var(--accent, #6d28d9)' },
    { key: 'applications', label: 'Applications', color: 'var(--warning)' },
  ],
  admin: [
    { key: 'steps', label: 'Steps completed', color: 'var(--primary)' },
    { key: 'checkins', label: 'Check-ins', color: 'var(--accent, #6d28d9)' },
    { key: 'applications', label: 'Applications', color: 'var(--warning)' },
    { key: 'registrations', label: 'New students', color: 'var(--info, #1d4ed8)' },
  ],
};

const dayLabel = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const weekday = (d) => new Date(`${d}T12:00:00`).getDay(); // 0 = Sunday

function Bars({ days, metrics }) {
  const max = Math.max(1, ...days.map((d) => metrics.reduce((t, m) => t + (m.key === 'registrations' ? 0 : d[m.key]), 0)));
  const stackMetrics = metrics.filter((m) => m.key !== 'registrations');
  return (
    <div className="prog-bars" role="img" aria-label="Daily activity bars" style={{ '--n': days.length }}>
      {days.map((d, i) => {
        const tip = `${dayLabel(d.date)}: ${stackMetrics.map((m) => `${d[m.key]} ${m.label.toLowerCase()}`).join(', ')}`;
        return (
          <div key={d.date} className="prog-bar-col" title={tip}>
            <div className="prog-bar-track">
              {stackMetrics.map((m) => (
                <span key={m.key} style={{ height: `${(d[m.key] / max) * 100}%`, background: m.color }} />
              ))}
            </div>
            <span className="prog-bar-label">{days.length <= 14 || i % 5 === 0 ? dayLabel(d.date).split(' ')[0] : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

function Rings({ summary, metrics, scope }) {
  const pct = summary.periodDays ? (summary.activeDays / summary.periodDays) * 100 : 0;
  const shareBase = Math.max(1, summary.total);
  return (
    <div className="prog-rings">
      <div className="prog-ring-main">
        <ProgressRing value={pct} size={140} stroke={12} label="Active days" sublabel={`${summary.activeDays}/${summary.periodDays} days`} />
        <p className="small muted mb-0" style={{ textAlign: 'center' }}>
          {scope === 'admin' ? 'Days with student activity' : 'Days you were active'}
          <br />
          <strong>Best streak: {summary.bestStreak} day{summary.bestStreak === 1 ? '' : 's'}</strong>
        </p>
      </div>
      <div className="prog-ring-grid">
        {metrics
          .filter((m) => m.key !== 'registrations')
          .map((m) => (
            <div key={m.key} className="prog-ring-sm">
              <ProgressRing value={(summary[m.key] / shareBase) * 100} size={84} stroke={8} label={`${m.label} share of activity`} />
              <div>
                <div className="bold">{summary[m.key]}</div>
                <div className="xs muted">{m.label}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Calendar({ days }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const lead = weekday(days[0].date);
  const cells = [...Array.from({ length: lead }, () => null), ...days];
  return (
    <div role="grid" aria-label="Activity calendar">
      <div className="prog-cal-head" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="prog-cal">
        {cells.map((d, i) =>
          d ? (
            <div
              key={d.date}
              role="gridcell"
              className="prog-cal-cell"
              style={{ '--lvl': d.total ? 0.18 + 0.82 * (d.total / max) : 0 }}
              title={`${dayLabel(d.date)}: ${d.total} activit${d.total === 1 ? 'y' : 'ies'}`}
            >
              <span>{Number(d.date.slice(8))}</span>
              {d.total > 0 && <b>{d.total}</b>}
            </div>
          ) : (
            <div key={`pad-${i}`} aria-hidden="true" />
          ),
        )}
      </div>
      <p className="xs muted mt-1 mb-0">Darker days mean more activity.</p>
    </div>
  );
}

function Delta({ now, before }) {
  if (!before && !now) return <span className="xs muted">No activity yet</span>;
  const diff = now - before;
  const up = diff >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="xs" style={{ color: up ? 'var(--success)' : 'var(--warning)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <Icon size={14} aria-hidden="true" />
      {up ? '+' : ''}
      {diff} vs previous period
    </span>
  );
}

/**
 * Weekly / fortnightly / monthly progress with three views (bars, circular rings, calendar).
 * `scope="student"` shows the signed-in student's own activity; `scope="admin"` aggregates every student.
 */
export function ProgressTracker({ scope = 'student' }) {
  const [period, setPeriod] = useState('week');
  const [view, setView] = useState('bars');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['progress', scope, period],
    queryFn: () => (scope === 'admin' ? adminApi.progress(period) : studentApi.progress(period)),
    placeholderData: (prev) => prev,
  });
  const metrics = METRICS[scope];
  const title = scope === 'admin' ? 'Student activity' : 'Your progress';
  const current = PERIODS.find((p) => p.value === period);

  return (
    <section className="card" aria-labelledby={`prog-${scope}`}>
      <div className="card-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 id={`prog-${scope}`}>{title}</h2>
          <p className="xs muted mb-0">{current.long}{scope === 'admin' ? ' · all students' : ''}</p>
        </div>
        <div className="row prog-controls" style={{ '--gap': '8px' }}>
          <div className="segmented" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button key={v.value} type="button" aria-pressed={view === v.value} onClick={() => setView(v.value)} title={v.label}>
                <v.icon size={14} aria-hidden="true" />
                <span className="sr-only">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <CardSkeleton lines={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="prog-totals">
            {metrics.map((m) => (
              <div key={m.key}>
                <div className="row" style={{ '--gap': '6px' }}>
                  <span className="prog-dot" style={{ background: m.color }} aria-hidden="true" />
                  <span className="xs muted">{m.label}</span>
                </div>
                <div className="prog-num">{data.data.summary[m.key]}</div>
                <Delta now={data.data.summary[m.key]} before={data.data.previous[m.key]} />
              </div>
            ))}
          </div>
          <div className="mt-2">
            {view === 'bars' && <Bars days={data.data.days} metrics={metrics} />}
            {view === 'rings' && <Rings summary={data.data.summary} metrics={metrics} scope={scope} />}
            {view === 'calendar' && <Calendar days={data.data.days} />}
          </div>
        </>
      )}
    </section>
  );
}
