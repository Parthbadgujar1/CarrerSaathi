import { Navigate, useLocation } from 'react-router-dom';
import { HOME_BY_ROLE, useAuth } from '../../store/auth.store';
import { PageLoader } from '../ui';

/** Protects a route tree; redirects guests to login and wrong roles to their own home. */
export function RequireAuth({ roles, children }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader label="Checking your session…" />;
  if (status !== 'authenticated') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}

/** Login/register pages: signed-in users go straight to their dashboard. */
export function GuestOnly({ children }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}

/** "/messages" from notifications resolves to the right inbox for each role. */
export function MessagesRedirect() {
  const user = useAuth((s) => s.user);
  const to = user?.role === 'mentor' ? '/mentor/messages' : user?.role === 'admin' ? '/admin' : '/app/connect';
  return <Navigate to={to} replace />;
}

/** Safe post-login redirect: only same-site relative paths are honoured (no open redirects). */
export function safeNext(next, role) {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
    const area = next.split('/')[1];
    const allowed = { student: ['app', 'meet', 'roadmaps'], mentor: ['mentor', 'meet', 'roadmaps'], admin: ['admin', 'meet', 'roadmaps'] }[role] || [];
    if (allowed.includes(area)) return next;
  }
  return HOME_BY_ROLE[role] || '/';
}
