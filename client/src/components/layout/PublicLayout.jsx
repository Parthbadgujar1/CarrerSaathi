import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu as MenuIcon, Search, X } from 'lucide-react';
import { PUBLIC_NAV, SITE } from '../../config/site';
import { HOME_BY_ROLE, useAuth } from '../../store/auth.store';
import { useUI } from '../../store/ui.store';
import { useScrollY } from '../../hooks';
import { BackToTop, Brand, ScrollProgress, ThemeToggle } from '../common/SiteChrome';
import { FloatingContact } from '../common/FloatingContact';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Button, IconButton } from '../ui';
import { Footer } from './Footer';

export function PublicLayout() {
  const { status, user } = useAuth();
  const setPalette = useUI((s) => s.setPalette);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(0);
  const headerRef = useRef(null);
  const y = useScrollY();
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Smooth-scroll to in-page anchors like /#features.
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  const authed = status === 'authenticated';

  return (
    <>
      <ScrollProgress />
      <div className="top-bar" role="note">
        <div className="container">
          <span className="pulse" aria-hidden="true" />
          <span>
            <strong>Free for every graduation student</strong> · part of the {SITE.company} family —{' '}
            <Link to="/#network">explore our portals</Link>
          </span>
        </div>
      </div>
      <header ref={headerRef} className={`site-header ${y > 8 ? 'scrolled' : ''}`}>
        <div className="container">
          <Brand sub="by Skill NexGen" />
          <nav className="nav-links" aria-label="Main">
            {PUBLIC_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive && !n.to.includes('#') ? 'active' : '')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <IconButton icon={Search} label="Search (Ctrl+K)" onClick={() => setPalette(true)} />
            <ThemeToggle />
            {authed ? (
              <Button variant="brand" to={HOME_BY_ROLE[user.role]} className="desktop-only">
                Open dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" to="/login" className="desktop-only">
                  Sign in
                </Button>
                <Button variant="brand" to="/register" className="desktop-only">
                  Get started free
                </Button>
              </>
            )}
            <IconButton
              icon={menuOpen ? X : MenuIcon}
              label={menuOpen ? 'Close menu' : 'Open menu'}
              className="mobile-only"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => {
                // Open the menu right under the header, wherever the announcement bar has scrolled to.
                setMenuTop(headerRef.current?.getBoundingClientRect().bottom || 0);
                setMenuOpen((o) => !o);
              }}
            />
          </div>
        </div>
      </header>

      {menuOpen && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile" style={menuTop ? { top: menuTop } : undefined}>
          {PUBLIC_NAV.map((n) => (
            <Link key={n.to} to={n.to} className="nav">
              {n.label}
            </Link>
          ))}
          <div className="stack mt-2" style={{ '--gap': '10px' }}>
            {authed ? (
              <Button variant="primary" block to={HOME_BY_ROLE[user.role]}>
                Open dashboard
              </Button>
            ) : (
              <>
                <Button variant="brand" block to="/register">
                  Get started free
                </Button>
                <Button block to="/login">
                  Sign in
                </Button>
              </>
            )}
          </div>
        </nav>
      )}

      <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
      <div className="floating-stack">
        <BackToTop />
        <FloatingContact />
      </div>
    </>
  );
}
