import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { useDocumentTitle, useForm } from '../../hooks';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert, Button, Checkbox, ChipsField, PasswordField, TextAreaField, TextField } from '../../components/ui';
import { passwordHint } from './Register';

const EXPERTISE = ['Web Development', 'Data Science', 'Cloud & DevOps', 'Cybersecurity', 'UI/UX Design', 'Product Management', 'Digital Marketing', 'Human Resources', 'Finance', 'Mechanical', 'Civil', 'Electronics', 'Government Exams', 'Interviews', 'Resume Review', 'Communication'];

export function MentorApply() {
  useDocumentTitle('Apply to become a mentor');
  const { values, bind, set, errors, setErrors } = useForm({
    name: '',
    email: '',
    phone: '',
    password: '',
    linkedin: '',
    bio: '',
    mentorProfile: { designation: '', company: '', expertise: [], experienceYears: '', availability: '' },
    terms: false,
  });
  const [state, setState] = useState({ status: 'idle' });

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'loading' });
    try {
      const res = await authService.applyMentor({
        ...values,
        mentorProfile: { ...values.mentorProfile, experienceYears: Number(values.mentorProfile.experienceYears) || 0 },
        consents: { terms: values.terms },
      });
      setState({ status: 'success', message: res.message });
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields['consents.terms']) fields.terms = fields['consents.terms'];
      setErrors(fields);
      setState({ status: 'error', message: getErrorMessage(err) });
    }
  };

  if (state.status === 'success') {
    return (
      <AuthLayout>
        <div className="empty" role="status">
          <div className="empty-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
            <CheckCircle2 aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: '1.4rem' }}>Application submitted</h1>
          <p>{state.message}</p>
          <Button to="/">Back to home</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout wide>
      <h1>Become a CareerSaathi mentor</h1>
      <p className="muted">
        Share your industry experience with students. Applications are reviewed by our team. Already approved? <Link to="/login">Sign in</Link>
      </p>
      <form onSubmit={submit} className="stack mt-2" noValidate>
        {state.status === 'error' && <Alert type="error">{state.message}</Alert>}
        <div className="form-grid">
          <TextField label="Full name" required autoComplete="name" maxLength={80} {...bind('name')} />
          <TextField label="Work email" type="email" required autoComplete="email" maxLength={160} {...bind('email')} />
          <TextField label="Phone" type="tel" autoComplete="tel" maxLength={20} hint="Optional — visible only to admins" {...bind('phone')} />
          <PasswordField label="Password" required autoComplete="new-password" hint={passwordHint(values.password)} maxLength={128} {...bind('password')} />
          <TextField label="Current designation" required maxLength={100} {...bind('mentorProfile.designation')} />
          <TextField label="Company / organisation" required maxLength={120} {...bind('mentorProfile.company')} />
          <TextField label="Years of experience" type="number" min={0} max={60} required {...bind('mentorProfile.experienceYears')} />
          <TextField label="LinkedIn profile URL" type="url" placeholder="https://www.linkedin.com/in/…" maxLength={300} {...bind('linkedin')} />
        </div>
        <ChipsField
          label="Areas of expertise"
          hint="Press Enter after each area"
          value={values.mentorProfile.expertise}
          onChange={(v) => set('mentorProfile.expertise', v)}
          error={errors['mentorProfile.expertise']}
          suggestions={EXPERTISE}
          max={10}
        />
        <TextField label="Availability" placeholder="e.g. Weekday evenings, 2 hours/week" maxLength={200} {...bind('mentorProfile.availability')} />
        <TextAreaField label="Short bio" rows={4} maxLength={1000} placeholder="Your journey and how you'd like to help students" {...bind('bio')} />
        <Checkbox
          checked={values.terms}
          onChange={(e) => set('terms', e.target.checked)}
          error={errors.terms}
          label={
            <>
              I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>, and I
              will never ask students for money or personal documents.
            </>
          }
        />
        <Button type="submit" variant="primary" size="lg" icon={Send} loading={state.status === 'loading'}>
          Submit application
        </Button>
      </form>
    </AuthLayout>
  );
}
