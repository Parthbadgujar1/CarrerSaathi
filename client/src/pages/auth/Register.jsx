import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { publicApi, roadmapApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { useConsent } from '../../store/ui.store';
import { getUtm } from '../../lib/utm';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { useDocumentTitle, useForm } from '../../hooks';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert, Button, Checkbox, PasswordField, SelectField, TextField } from '../../components/ui';

export const DEGREES = ['B.Tech', 'B.E.', 'B.Sc', 'BCA', 'B.Com', 'BBA', 'BMS', 'BA', 'B.Des', 'B.Arch', 'B.Pharm', 'LLB', 'Diploma', 'M.Tech', 'M.Sc', 'MCA', 'MBA', 'M.Com', 'MA', 'PhD', 'Other'];
const LEVEL_BY_DEGREE = (d) => (d === 'Diploma' ? 'Diploma' : d === 'PhD' ? 'PhD' : /^M/.test(d) ? 'PG' : 'UG');
const thisYear = new Date().getFullYear();
export const GRAD_YEARS = Array.from({ length: 10 }, (_, i) => String(thisYear - 2 + i));

/** Password strength hint (guidance only; the server enforces the real policy). */
export function passwordHint(pw) {
  if (!pw) return 'At least 8 characters with a letter and a number.';
  const score = [pw.length >= 8, /[A-Za-z]/.test(pw) && /\d/.test(pw), pw.length >= 12, /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
  return ['Too weak', 'Weak', 'Okay', 'Strong', 'Very strong'][score];
}

export function Register() {
  useDocumentTitle('Create your account');
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const analytics = useConsent((s) => s.consent?.analytics);
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'list', '', ''], queryFn: () => roadmapApi.list() });
  const { data: config } = useQuery({ queryKey: ['public-config'], queryFn: publicApi.config });
  const { values, bind, set, errors, setErrors } = useForm({
    name: '',
    email: '',
    phone: '',
    password: '',
    education: { degree: '', branch: '', college: '', graduationYear: '', currentYear: '' },
    track: '',
    terms: false,
    marketingEmails: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authService.register({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        education: {
          ...values.education,
          level: LEVEL_BY_DEGREE(values.education.degree),
          graduationYear: Number(values.education.graduationYear) || undefined,
          currentYear: Number(values.education.currentYear) || undefined,
        },
        careerTracks: values.track ? [values.track] : [],
        consents: { terms: values.terms, marketingEmails: values.marketingEmails },
        utm: getUtm(analytics),
      });
      setSession(res.data.user, res.data.accessToken);
      toast.success('Welcome to CareerSaathi! Check your inbox to verify your email.');
      navigate('/app', { replace: true });
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields['consents.terms']) fields.terms = fields['consents.terms'];
      setErrors(fields);
      setError(getErrorMessage(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (config?.data && !config.data.registrationOpen) {
    return (
      <AuthLayout>
        <h1>Registrations are paused</h1>
        <Alert type="info">New student registrations are temporarily closed. Please check back soon or <Link to="/contact">contact us</Link>.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout wide>
      <h1>Create your free student account</h1>
      <p className="muted">
        Takes about two minutes. Already registered? <Link to="/login">Sign in</Link>
      </p>
      <form onSubmit={submit} className="stack mt-2" noValidate>
        {error && <Alert type="error" title="Please fix the highlighted fields">{error}</Alert>}
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label mb-1">About you</legend>
          <div className="form-grid">
            <TextField label="Full name" required autoComplete="name" maxLength={80} {...bind('name')} />
            <TextField label="Email" type="email" required autoComplete="email" maxLength={160} {...bind('email')} />
            <TextField label="Mobile number" type="tel" autoComplete="tel" placeholder="+91 98765 43210" hint="Optional — used only by programme admins" maxLength={20} {...bind('phone')} />
            <PasswordField label="Create password" required autoComplete="new-password" maxLength={128} hint={passwordHint(values.password)} {...bind('password')} />
          </div>
        </fieldset>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label mb-1">Education</legend>
          <div className="form-grid">
            <SelectField label="Degree" required placeholder="Select degree" options={DEGREES} {...bind('education.degree')} />
            <TextField label="Branch / specialisation" placeholder="e.g. CSE, Finance, Mechanical" maxLength={80} {...bind('education.branch')} />
            <TextField label="College / university" required autoComplete="organization" maxLength={160} {...bind('education.college')} />
            <SelectField label="Graduation year" required placeholder="Select year" options={GRAD_YEARS} {...bind('education.graduationYear')} />
            <SelectField label="Current year of study" placeholder="Select" options={['1', '2', '3', '4', '5']} {...bind('education.currentYear')} />
            <SelectField
              label="Career interest"
              placeholder="Not sure yet"
              hint="You can add more or take a quiz later"
              options={(roadmaps?.data || []).map((r) => ({ value: r.slug, label: r.title }))}
              {...bind('track')}
            />
          </div>
        </fieldset>
        <div className="stack" style={{ '--gap': '10px' }}>
          <Checkbox
            checked={values.terms}
            onChange={(e) => set('terms', e.target.checked)}
            error={errors.terms}
            label={
              <>
                I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and have read the{' '}
                <Link to="/privacy" target="_blank">Privacy Policy</Link>. <span className="subtle">(required)</span>
              </>
            }
          />
          <Checkbox
            checked={values.marketingEmails}
            onChange={(e) => set('marketingEmails', e.target.checked)}
            label={<>Email me occasional announcements about sessions and opportunities. <span className="subtle">(optional — unsubscribe any time)</span></>}
          />
        </div>
        <Button type="submit" variant="primary" size="lg" loading={loading} icon={UserPlus}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
