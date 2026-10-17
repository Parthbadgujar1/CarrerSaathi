/**
 * Lightweight, dependency-free SVG charts (single series, one validated hue).
 * Every chart has: hover + keyboard tooltip, recessive hairline grid,
 * 4px rounded data-ends, and a "Table" view so no value is gated behind hover.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const niceMax = (v) => {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};
const compact = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));

/** Card wrapper with a chart/table toggle. */
export function ChartCard({ title, subtitle, rows, columns, children, action }) {
  const [view, setView] = useState('chart');
  return (
    <section className="card" aria-label={title}>
      <div className="card-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="xs muted mb-0">{subtitle}</p>}
        </div>
        <div className="row" style={{ '--gap': '6px' }}>
          {action}
          {rows && (
            <div className="segmented" role="group" aria-label="Display as">
              <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')} title="Chart view">
                <BarChart3 size={14} aria-hidden="true" />
                <span className="sr-only">Chart</span>
              </button>
              <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} title="Table view">
                <Table2 size={14} aria-hidden="true" />
                <span className="sr-only">Table</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {view === 'table' && rows ? <DataTable rows={rows} columns={columns} /> : children}
    </section>
  );
}

export function DataTable({ rows, columns = ['Label', 'Value'] }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.display ?? r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tooltip({ x, y, title, value, width }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left,
        top: y,
        transform: 'translate(-50%, calc(-100% - 10px))',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 12,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 5,
      }}
    >
      <div className="muted">{title}</div>
      <div className="bold" style={{ color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

/** Rounded-top column path: square at the baseline, 4px radius at the data end. */
const columnPath = (x, y, w, h, r = 4) => {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
};

function useActiveIndex(count) {
  const [active, setActive] = useState(null);
  const onKeyDown = (e) => {
    if (!count) return;
    if (e.key === 'ArrowRight') setActive((a) => (a === null ? 0 : Math.min(count - 1, a + 1)));
    else if (e.key === 'ArrowLeft') setActive((a) => (a === null ? count - 1 : Math.max(0, a - 1)));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };
  return { active, setActive, onKeyDown };
}

/** Vertical columns over a time axis (e.g. sign-ups per day). */
export function ColumnChart({ data, height = 200, valueLabel = (v) => v, tickEvery = 7, ariaLabel }) {
  const [ref, width] = useWidth();
  const { active, setActive, onKeyDown } = useActiveIndex(data.length);
  const pad = { top: 12, right: 8, bottom: 26, left: 32 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2)); // 2px surface gap between neighbours
  // Whole-number ticks only (these charts count people / hours).
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  // Never let x-axis labels collide: at least ~56px between labels at the rendered width.
  const labelStep = Math.max(tickEvery, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 56))));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onMouseLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {ticks.map((t) => {
            const y = pad.top + innerH - (t / max) * innerH;
            return (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-subtle)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {compact(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const h = (d.value / max) * innerH;
            const x = pad.left + i * band + (band - barW) / 2;
            const y = pad.top + innerH - h;
            return (
              <g key={d.label} onMouseEnter={() => setActive(i)}>
                {/* Full-height transparent hit target, wider than the mark */}
                <rect x={pad.left + i * band} y={pad.top} width={band} height={innerH} fill="transparent" />
                <path d={columnPath(x, y, barW, h)} fill="var(--chart-1)" opacity={active === null || active === i ? 1 : 0.45} />
                {i % labelStep === 0 && (
                  <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--text-subtle)">
                    {d.short || d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip
          width={width}
          x={pad.left + active * band + band / 2}
          y={pad.top + innerH - (data[active].value / max) * innerH}
          title={data[active].label}
          value={valueLabel(data[active].value)}
        />
      )}
    </div>
  );
}

/** Line with end-dot for a bounded scale (e.g. mood 1–5). */
export function LineChart({ data, height = 190, yMin = 0, yMax, valueLabel = (v) => v, ariaLabel, yTicks }) {
  const [ref, width] = useWidth();
  const gradientId = useId().replace(/:/g, '');
  const { active, setActive, onKeyDown } = useActiveIndex(data.length);
  const pad = { top: 14, right: 14, bottom: 26, left: 30 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = yMax ?? niceMax(Math.max(1, ...data.map((d) => d.value ?? 0)));
  const xAt = (i) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v) => pad.top + innerH - ((v - yMin) / (max - yMin)) * innerH;
  const points = data.map((d, i) => (d.value === null || d.value === undefined ? null : [xAt(i), yAt(d.value)]));
  const segments = [];
  let cur = [];
  for (const p of points) {
    if (p) cur.push(p);
    else if (cur.length) {
      segments.push(cur);
      cur = [];
    }
  }
  if (cur.length) segments.push(cur);
  const ticks = yTicks || [yMin, (yMin + max) / 2, max];
  const lastIdx = points.map((p, i) => (p ? i : -1)).filter((i) => i >= 0).pop();

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = null;
    let bestD = Infinity;
    points.forEach((p, i) => {
      if (p && Math.abs(p[0] - x) < bestD) {
        bestD = Math.abs(p[0] - x);
        best = i;
      }
    });
    setActive(best);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} tabIndex={0} onKeyDown={onKeyDown} onMouseMove={onMove} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.12" />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={pad.left - 6} y={yAt(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-subtle)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t}
              </text>
            </g>
          ))}
          {segments.map((seg, si) => (
            <g key={si}>
              {seg.length > 1 && (
                <path d={`M${seg[0][0]},${pad.top + innerH} ${seg.map((p) => `L${p[0]},${p[1]}`).join(' ')} L${seg.at(-1)[0]},${pad.top + innerH} Z`} fill={`url(#${gradientId})`} />
              )}
              <polyline points={seg.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {active !== null && points[active] && <line x1={points[active][0]} x2={points[active][0]} y1={pad.top} y2={pad.top + innerH} stroke="var(--border-strong)" strokeWidth="1" />}
          {points.map((p, i) =>
            p && (i === active || i === lastIdx) ? <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" /> : null,
          )}
          {data.map((d, i) => {
            // Space labels by measured pixels (~56px each) and always label the final point;
            // a regular tick too close to the final label is dropped so they never overlap.
            const MIN_GAP = 56;
            const step = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / MIN_GAP))));
            const last = data.length - 1;
            const show = i === last || (i % step === 0 && xAt(last) - xAt(i) >= MIN_GAP);
            return show ? (
              <text key={d.label} x={xAt(i)} y={height - 6} textAnchor={i === last ? 'end' : 'middle'} fontSize="11" fill="var(--text-subtle)">
                {d.short || d.label}
              </text>
            ) : null;
          })}
        </svg>
      )}
      {active !== null && points[active] && <Tooltip width={width} x={points[active][0]} y={points[active][1]} title={data[active].label} value={valueLabel(data[active].value)} />}
    </div>
  );
}

/** Horizontal bars for ranked categories; value at the bar tip. */
export function BarList({ data: raw, valueLabel = (v) => v, ariaLabel }) {
  // A missing value is a 0, never a full-width bar.
  const data = raw.map((d) => ({ ...d, value: Number.isFinite(Number(d.value)) ? Number(d.value) : 0 }));
  const max = Math.max(1, ...data.map((d) => d.value));
  const [active, setActive] = useState(null);
  if (!data.length) return <p className="small muted">No data yet.</p>;
  return (
    <ul className="list-plain stack" style={{ '--gap': '10px' }} aria-label={ariaLabel}>
      {data.map((d, i) => (
        <li key={d.label} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} title={`${d.label}: ${valueLabel(d.value)}`}>
          <div className="row-between small" style={{ marginBottom: 4 }}>
            <span className="truncate" style={{ maxWidth: '75%' }}>{d.label}</span>
            <span className="bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{valueLabel(d.value)}</span>
          </div>
          <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 4 }} aria-hidden="true">
            <div
              style={{
                width: `${Math.max(2, (d.value / max) * 100)}%`,
                height: '100%',
                background: 'var(--chart-1)',
                borderRadius: '0 4px 4px 0',
                opacity: active === null || active === i ? 1 : 0.5,
                transition: 'width 0.5s var(--ease), opacity 0.15s',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
