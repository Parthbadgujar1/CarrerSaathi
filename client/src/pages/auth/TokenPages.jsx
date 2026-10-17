/** Single-purpose pages reached from email links (and forgot password). */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, Mail, MailX, XCircle } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { userApi } from '../../services/api';
import { HOME_BY_ROLE, useAuth } from '../../store/auth.store';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { useDocumentTitle } from '../../hooks';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert, Button, PageLoader, PasswordField, TextField } from '../../components/ui';
import { passwordHint } from './Register';

function Result({ ok, title, children, action }) {
  return (
    <div className="empty" role={ok ? 'status' : 'alert'}>
      <div className="empty-icon" style={ok ? { background: 'var(--success-soft)', color: 'var(--success)' } : { background: 'var(--danger-soft)', color: 'var(--danger)' }}>
        {ok ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
      </div>
      <h1 style={{ fontSize: '1.4rem' }}>{title}</h1>
      <div>{children}</div>
      {action}
    </div>
  );
}

export function ForgotPassword() {
  useDocumentTitle('Reset your password');
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'loading' });
    try {
      const res = await authService.forgotPassword(email);
      setState({ status: 'success', message: res.message });
    } catch (err) {
      setState({ status: 'error', message: getErrorMessage(err), fields: getFieldErrors(err) });
    }
  };
  return (
    <AuthLayout>
      {state.status === 'success' ? (
        <Result ok title="Check your inbox" action={<Button to="/login">Back to sign in</Button>}>
          {state.message} The link expires in 30 minutes.
        </Result>
      ) : (
        <>
          <h1>Forgot your password?</h1>
          <p className="muted">Enter your account email and we'll send you a secure link to choose a new password.</p>
          <form onSubmit={submit} className="stack mt-2" noValidate>
            {state.status === 'error' && <Alert type="error">{state.message}</Alert>}
            <TextField label="Email" type="email" icon={Mail} required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={state.fields?.email} />
            <Button type="submit" variant="primary" size="lg" loading={state.status === 'loading'}>
              Send reset link
            </Button>
            <Link to="/login" className="small center">
              Back to sign in
            </Link>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

function SetPasswordForm({ title, intro, cta, onSubmit }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setState({ status: 'error', message: 'Passwords do not match.', fields: { confirm: 'Passwords do not match' } });
      return;
    }
    setState({ status: 'loading' });
    try {
      await onSubmit(password);
    } catch (err) {
      setState({ status: 'error', message: getErrorMessage(err), fields: getFieldErrors(err) });
    }
  };
  return (
    <>
      <h1>{title}</h1>
      <p className="muted">{intro}</p>
      <form onSubmit={submit} className="stack mt-2" noValidate>
        {state.status === 'error' && <Alert type="error">{state.message}</Alert>}
        <PasswordField label="New password" required autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint={passwordHint(password)} error={state.fields?.password} />
        <PasswordField label="Confirm new password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={state.fields?.confirm} />
        <Button type="submit" variant="primary" size="lg" icon={KeyRound} loading={state.status === 'loading'}>
          {cta}
        </Button>
      </form>
    </>
  );
}

export function ResetPassword() {
  useDocumentTitle('Choose a new password');
  const { token } = useParams();
  const [done, setDone] = useState(null);
  const clear = useAuth((s) => s.clear);
  return (
    <AuthLayout>
      {done ? (
        <Result ok title="Password updated" action={<Button variant="primary" to="/login">Sign in</Button>}>
          {done} For your security, all devices were signed out.
        </Result>
      ) : (
        <SetPasswordForm
          title="Choose a new password"
          intro="Use at least 8 characters with a letter and a number. Avoid passwords you use elsewhere."
          cta="Update password"
          onSubmit={async (password) => {
            const res = await authService.resetPassword(token, password);
            clear();
            setDone(res.message);
          }}
        />
      )}
    </AuthLayout>
  );
}

export function AcceptInvite() {
  useDocumentTitle('Activate your account');
  const { token } = useParams();
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  return (
    <AuthLayout>
      <SetPasswordForm
        title="Activate your account"
        intro="You've been invited to CareerSaathi. Set a password to activate your account. By continuing you agree to our Terms and Privacy Policy."
        cta="Activate account"
        onSubmit={async (password) => {
          const res = await authService.acceptInvite(token, password);
          setSession(res.data.user, res.data.accessToken);
          navigate(HOME_BY_ROLE[res.data.user.role], { replace: true });
        }}
      />
    </AuthLayout>
  );
}

/** Runs a one-shot token action once (guards against React StrictMode double effects). */
function useOneShot(action) {
  const [state, setState] = useState({ status: 'loading' });
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    action()
      .then((res) => setState({ status: 'success', message: res.message }))
      .catch((err) => setState({ status: 'error', message: getErrorMessage(err) }));
  }, [action]);
  return state;
}

export function VerifyEmail() {
  useDocumentTitle('Verify email');
  const { token } = useParams();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const state = useOneShot(async () => {
    const res = await authService.verifyEmail(token);
    if (user) setUser({ ...user, emailVerified: true });
    return res;
  });
  return (
    <AuthLayout>
      {state.status === 'loading' ? (
        <PageLoader label="Verifying your email…" />
      ) : (
        <Result
          ok={state.status === 'success'}
          title={state.status === 'success' ? 'Email verified' : 'Verification failed'}
          action={<Button variant="primary" to={user ? HOME_BY_ROLE[user.role] : '/login'}>{user ? 'Go to dashboard' : 'Sign in'}</Button>}
        >
          {state.message}
          {state.status === 'error' && ' You can request a new link from your dashboard.'}
        </Result>
      )}
    </AuthLayout>
  );
}

export function Unsubscribe() {
  useDocumentTitle('Unsubscribe');
  const { token } = useParams();
  const state = useOneShot(() => userApi.unsubscribe(token));
  return (
    <div className="container section" style={{ maxWidth: 560 }}>
      {state.status === 'loading' ? (
        <PageLoader label="Updating your preferences…" />
      ) : (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">
              <MailX aria-hidden="true" />
            </div>
            <h1 style={{ fontSize: '1.4rem' }}>{state.status === 'success' ? "You're unsubscribed" : 'Link not valid'}</h1>
            <p>{state.message}</p>
            <p className="small muted">You will still receive essential account emails (like password resets). You can re-enable announcements in Profile → Settings.</p>
            <Button to="/">Back to home</Button>
          </div>
        </div>
      )}
    </div>
  );
}
