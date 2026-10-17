import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, Mail } from 'lucide-react';
import { useAuth } from '../../store/auth.store';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { useDocumentTitle, useForm } from '../../hooks';
import { safeNext } from '../../components/common/RouteGuards';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert, Button, Checkbox, PasswordField, TextField } from '../../components/ui';

export function Login() {
  useDocumentTitle('Sign in');
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { values, bind, set, setErrors } = useForm({ email: '', password: '', remember: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(values);
      if (res.message) toast.success(res.message);
      navigate(safeNext(params.get('next'), res.data.user.role), { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1>Welcome back</h1>
      <p className="muted">Sign in to continue to your dashboard.</p>
      <form onSubmit={submit} className="stack mt-2" noValidate>
        {error && <Alert type="error">{error}</Alert>}
        <TextField label="Email" type="email" icon={Mail} autoComplete="email" required autoFocus maxLength={160} {...bind('email')} />
        <PasswordField label="Password" autoComplete="current-password" required maxLength={128} {...bind('password')} />
        <div className="row-between">
          <Checkbox label="Remember me for 30 days" checked={values.remember} onChange={(e) => set('remember', e.target.checked)} />
          <Link to="/forgot-password" className="small">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" block loading={loading} icon={LogIn}>
          Sign in
        </Button>
      </form>
      <div className="divider-text mt-3 mb-2">New to CareerSaathi?</div>
      <div className="grid-2" style={{ gap: 10 }}>
        <Button to="/register" block>
          Create student account
        </Button>
        <Button to="/mentor-apply" variant="ghost" block>
          Apply as a mentor
        </Button>
      </div>
    </AuthLayout>
  );
}
