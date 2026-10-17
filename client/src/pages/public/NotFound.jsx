import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, Home, Search } from 'lucide-react';
import { useDocumentTitle } from '../../hooks';
import { useUI } from '../../store/ui.store';
import { HOME_BY_ROLE, useAuth } from '../../store/auth.store';
import { Button } from '../../components/ui';

/** Custom 404 — helpful next steps instead of a dead end. */
export function NotFound({ inApp }) {
  useDocumentTitle('Page not found');
  const setPalette = useUI((s) => s.setPalette);
  const user = useAuth((s) => s.user);
  const home = user ? HOME_BY_ROLE[user.role] : '/';
  return (
    <div className="error-page">
      <div style={{ maxWidth: 520 }}>
        <div className="error-code" aria-hidden="true">404</div>
        <h1 style={{ fontSize: '1.6rem' }}>This page took a different career path</h1>
        <p className="muted">The link may be broken or the page may have moved. Here are some ways to get back on track:</p>
        <div className="row" style={{ justifyContent: 'center', '--gap': '10px' }}>
          <Button variant="primary" to={home} icon={Home}>
            {inApp ? 'Back to dashboard' : 'Go home'}
          </Button>
          <Button icon={Search} onClick={() => setPalette(true)}>
            Search the site
          </Button>
          {!inApp && (
            <Button to="/roadmaps" icon={Compass}>
              Browse roadmaps
            </Button>
          )}
        </div>
        <button type="button" className="linklike small mt-3 row" style={{ margin: '24px auto 0', '--gap': '6px' }} onClick={() => window.history.back()}>
          <ArrowLeft size={14} aria-hidden="true" /> Go back to the previous page
        </button>
        <p className="xs subtle mt-2">
          Think something is broken? <Link to="/contact">Let us know</Link>.
        </p>
      </div>
    </div>
  );
}
