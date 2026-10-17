import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bell, LogOut, Megaphone, Menu as MenuIcon, Search, Settings, Sparkles, UserCircle } from 'lucide-react';
import { useAuth } from '../../store/auth.store';
import { useUI } from '../../store/ui.store';
import { chatApi, notificationApi, publicApi } from '../../services/api';
import { authService } from '../../services/auth.service';
import { connectSocket } from '../../lib/socket';
import { getErrorMessage } from '../../lib/http';
import { timeAgo } from '../../lib/format';
import { Avatar, IconButton, Menu } from '../ui';
import { Brand, ThemeToggle } from '../common/SiteChrome';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { AiAssistant } from '../common/AiAssistant';
import { NAV_BY_ROLE, PROFILE_PATH } from './navigation';
import { ECOSYSTEM } from '../../config/site';

const ROLE_LABEL = { student: 'Student', mentor: 'Mentor', admin: 'Admin' };

export function DashboardLayout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { sidebarOpen, setSidebar, setPalette, aiOpen, setAI } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => setSidebar(false), [location.pathname, setSidebar]);

  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatApi.conversations,
    enabled: user.role !== 'admin',
    refetchInterval: 60_000,
  });
  const unreadMessages = (convData?.data || []).reduce((n, c) => n + (c.unread || 0), 0);
  const { data: config } = useQuery({ queryKey: ['public-config'], queryFn: publicApi.config, staleTime: 5 * 60_000 });

  // Realtime: notifications + chat badge. Falls back to polling if the socket can't connect.
  useEffect(() => {
    const socket = connectSocket();
    const onNotification = (n) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (n.type !== 'message' || !location.pathname.includes('connect') && !location.pathname.includes('messages')) {
        toast(n.title, { icon: '🔔', id: n._id });
      }
    };
    const onMessage = () => qc.invalidateQueries({ queryKey: ['conversations'] });
    socket.on('notification:new', onNotification);
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('notification:new', onNotification);
      socket.off('chat:message', onMessage);
    };
  }, [qc, location.pathname]);

  const nav = NAV_BY_ROLE[user.role];
  const announcement = config?.data?.announcementBanner;

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebar(false)} aria-hidden="true" />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Sidebar">
        <div className="sidebar-head">
          <Brand to={nav[0].to} sub={`${ROLE_LABEL[user.role]} workspace`} />
        </div>
        <nav aria-label="Dashboard">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
              <item.icon aria-hidden="true" />
              {item.label}
              {item.badge === 'messages' && unreadMessages > 0 && (
                <span className="count" aria-label={`${unreadMessages} unread`}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="ecosystem-card">
            Part of the <strong>Skill NexGen</strong> family:{' '}
            {ECOSYSTEM.map((p, i) => (
              <span key={p.key}>
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {p.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {i < ECOSYSTEM.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <IconButton icon={MenuIcon} label="Open navigation" className="nav-toggle" onClick={() => setSidebar(true)} aria-expanded={sidebarOpen} />
          <button type="button" className="search-trigger" onClick={() => setPalette(true)} aria-label="Search (Ctrl+K)">
            <Search aria-hidden="true" />
            <span className="flex-1" style={{ textAlign: 'left' }}>Search…</span>
            <span className="kbd-hint" aria-hidden="true">
              <kbd>Ctrl</kbd>
              <kbd>K</kbd>
            </span>
          </button>
          <IconButton icon={Search} label="Search" className="search-icon-mobile" onClick={() => setPalette(true)} />
          <div className="header-actions">
            {user.role !== 'admin' && (
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setAI(true)} aria-expanded={aiOpen}>
                <Sparkles aria-hidden="true" /> <span className="hide-sm">Ask Saathi</span>
              </button>
            )}
            <NotificationBell />
            <ThemeToggle />
            <Menu
              width={240}
              trigger={(props) => (
                <button type="button" className="icon-btn" aria-label="Account menu" style={{ width: 'auto', padding: '0 4px' }} {...props}>
                  <Avatar name={user.name} size={32} />
                </button>
              )}
            >
              <div style={{ padding: '8px 10px' }}>
                <div className="bold truncate">{user.name}</div>
                <div className="xs muted truncate">{user.email}</div>
              </div>
              <div className="menu-sep" />
              <Link role="menuitem" className="menu-item" to={PROFILE_PATH[user.role]}>
                <UserCircle aria-hidden="true" /> Profile
              </Link>
              <Link role="menuitem" className="menu-item" to={`${PROFILE_PATH[user.role]}?tab=settings`}>
                <Settings aria-hidden="true" /> Account & privacy
              </Link>
              <div className="menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut aria-hidden="true" /> Sign out
              </button>
            </Menu>
          </div>
        </header>

        {!user.emailVerified && <VerifyBanner />}
        {announcement && (
          <div className="banner banner-info" role="status">
            <Megaphone aria-hidden="true" /> <span>{announcement}</span>
          </div>
        )}

        <main id="main" className="page" tabIndex={-1} style={{ outline: 'none' }}>
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      {aiOpen && <AiAssistant onClose={() => setAI(false)} />}
    </div>
  );
}

function VerifyBanner() {
  const resend = async () => {
    try {
      const res = await authService.resendVerification();
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };
  return (
    <div className="banner" role="status">
      <Bell aria-hidden="true" />
      <span className="flex-1">Please verify your email address to secure your account.</span>
      <button type="button" className="btn btn-sm" onClick={resend}>
        Resend link
      </button>
    </div>
  );
}

function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => notificationApi.list({ limit: 15 }), refetchInterval: 90_000 });
  const items = data?.data?.items || [];
  const unread = data?.data?.unread || 0;

  const open = async (n) => {
    if (!n.readAt) {
      await notificationApi.read(n._id).catch(() => {});
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.link) navigate(n.link);
  };

  return (
    <Menu
      width={340}
      trigger={(props) => (
        <button type="button" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} {...props}>
          <Bell aria-hidden="true" />
          {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
        </button>
      )}
    >
      <div className="row-between" style={{ padding: '6px 10px' }}>
        <span className="bold">Notifications</span>
        {unread > 0 && (
          <button
            type="button"
            className="linklike small"
            onClick={async (e) => {
              e.stopPropagation();
              await notificationApi.readAll();
              qc.invalidateQueries({ queryKey: ['notifications'] });
            }}
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="menu-sep" />
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {items.length === 0 && <p className="small muted center" style={{ padding: 20 }}>You're all caught up.</p>}
        {items.map((n) => (
          <button key={n._id} type="button" role="menuitem" className="menu-item" style={{ alignItems: 'flex-start' }} onClick={() => open(n)}>
            <span style={{ width: 8, height: 8, marginTop: 7, borderRadius: 4, flexShrink: 0, background: n.readAt ? 'transparent' : 'var(--primary)' }} aria-hidden="true" />
            <span className="flex-1" style={{ minWidth: 0 }}>
              <span className={`small ${n.readAt ? '' : 'bold'}`} style={{ display: 'block' }}>{n.title}</span>
              {n.body && <span className="xs muted" style={{ display: 'block' }}>{n.body}</span>}
              <span className="xs subtle">{timeAgo(n.createdAt)}</span>
            </span>
          </button>
        ))}
      </div>
    </Menu>
  );
}
