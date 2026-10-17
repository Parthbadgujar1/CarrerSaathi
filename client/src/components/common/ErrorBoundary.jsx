import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Catches render errors so one broken widget never blanks the whole app.
 * `variant="section"` renders an inline fallback; the default is a full page.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Hook point for an error-reporting service; console only in this build.
    console.error('UI error captured by boundary:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.variant === 'section') {
      return (
        <div className="card" role="alert">
          <div className="row">
            <AlertTriangle size={18} color="var(--danger)" aria-hidden="true" />
            <span className="flex-1 small">This section failed to load.</span>
            <button type="button" className="btn btn-sm" onClick={() => this.setState({ error: null })}>
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="error-page" role="alert">
        <div>
          <div className="error-code">Oops</div>
          <h1 style={{ fontSize: '1.5rem' }}>Something went wrong on this page</h1>
          <p className="muted">The rest of CareerSaathi is still working. Try reloading, or head back home.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw aria-hidden="true" /> Reload page
            </button>
            <a className="btn" href="/">
              <Home aria-hidden="true" /> Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
