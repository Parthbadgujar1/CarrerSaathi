import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Briefcase, Compass, CornerDownLeft, FileText, Hash, Search, Users } from 'lucide-react';
import { createPortal } from 'react-dom';
import { publicApi } from '../../services/api';
import { useDebounce, useFocusTrap } from '../../hooks';
import { useUI } from '../../store/ui.store';
import { useAuth } from '../../store/auth.store';
import { NAV_BY_ROLE } from '../layout/navigation';

const PUBLIC_PAGES = [
  { label: 'Home', to: '/' },
  { label: 'Roadmap library', to: '/roadmaps' },
  { label: 'Frequently asked questions', to: '/faq' },
  { label: 'Contact us', to: '/contact' },
  { label: 'Privacy policy', to: '/privacy' },
  { label: 'Terms of service', to: '/terms' },
  { label: 'Cookie policy', to: '/cookies' },
  { label: 'Sign in', to: '/login' },
  { label: 'Create a free account', to: '/register' },
  { label: 'Become a mentor', to: '/mentor-apply' },
];

/** Site-wide search (Ctrl/⌘ + K): pages, roadmaps, opportunities and communities. */
export function CommandPalette() {
  const { paletteOpen, setPalette } = useUI();
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(!useUI.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette]);
  return paletteOpen ? createPortal(<Palette onClose={() => setPalette(false)} />, document.body) : null;
}

function Palette({ onClose }) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebounce(q.trim(), 250);
  const ref = useFocusTrap(true, onClose);
  const listRef = useRef(null);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced, Boolean(user)],
    queryFn: () => publicApi.search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = (user ? NAV_BY_ROLE[user.role].map((n) => ({ label: n.label, to: n.to })) : []).concat(PUBLIC_PAGES);
    const pageHits = pages.filter((p) => !term || p.label.toLowerCase().includes(term)).slice(0, term ? 6 : 8).map((p) => ({ ...p, group: 'Pages', icon: FileText }));
    const res = data?.data || {};
    const roadmapBase = user?.role === 'student' ? '/app/roadmap/' : '/roadmaps/';
    return [
      ...pageHits,
      ...(res.roadmaps || []).map((r) => ({ group: 'Roadmaps', icon: Compass, label: r.title, hint: r.category, to: `${roadmapBase}${r.slug}` })),
      ...(res.opportunities || []).map((o) => ({ group: 'Opportunities', icon: Briefcase, label: o.title, hint: o.organization, to: `${user?.role === 'student' ? '/app' : `/${user?.role}`}/opportunities?q=${encodeURIComponent(o.title)}` })),
      ...(res.communities || []).map((c) => ({ group: 'Communities', icon: Hash, label: c.name, hint: `${c.memberCount} members`, to: '/app/connect?tab=communities' })),
    ];
  }, [q, data, user]);

  useEffect(() => setActive(0), [q, data]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (item) => {
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      go(items[active]);
    }
  };

  let lastGroup = null;
  return (
    <div className="overlay palette-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="palette" role="dialog" aria-modal="true" aria-label="Search CareerSaathi">
        <div className="palette-input">
          <Search aria-hidden="true" />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, roadmaps, opportunities…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={items[active] ? `pi-${active}` : undefined}
            maxLength={80}
          />
          {isFetching && <span className="spinner" aria-hidden="true" />}
        </div>
        <div className="palette-results" id="palette-results" role="listbox" ref={listRef}>
          {items.length === 0 && (
            <div className="empty" style={{ padding: 28 }}>
              <Users aria-hidden="true" size={20} />
              <span className="small">{debounced.length >= 2 ? `No results for “${debounced}”.` : 'Type at least 2 characters to search.'}</span>
            </div>
          )}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? <div className="palette-group">{item.group}</div> : null;
            lastGroup = item.group;
            return (
              <div key={`${item.group}-${item.to}-${i}`}>
                {header}
                <button
                  id={`pi-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className="palette-item"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  <item.icon aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="xs subtle truncate">{item.hint}</span>}
                  {i === active && <ArrowRight size={14} aria-hidden="true" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>
              <CornerDownLeft size={10} />
            </kbd>{' '}
            open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
