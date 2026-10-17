import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail, MapPin, Phone, Send } from 'lucide-react';
import { publicApi } from '../../services/api';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { useDocumentTitle, useForm } from '../../hooks';
import { Alert, Button, Checkbox, TextAreaField, TextField } from '../../components/ui';
import { SITE } from '../../config/site';

export function Contact() {
  useDocumentTitle('Contact us');
  const { values, bind, set, setErrors, errors, setValues } = useForm({ name: '', email: '', subject: '', message: '', consent: false, website: '' });
  const [status, setStatus] = useState({ state: 'idle' });

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'loading' });
    try {
      const res = await publicApi.contact(values);
      setStatus({ state: 'success', message: res.message });
      setValues({ name: '', email: '', subject: '', message: '', consent: false, website: '' });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setStatus({ state: 'error', message: getErrorMessage(err) });
    }
  };

  return (
    <div className="container">
      <header className="page-head">
        <h1>Contact us</h1>
        <p className="muted">Questions, feedback, partnership ideas or a data request — we read every message.</p>
      </header>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          {status.state === 'success' ? (
            <div className="empty" role="status">
              <div className="empty-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                <CheckCircle2 aria-hidden="true" />
              </div>
              <h3>Message sent</h3>
              <p className="small">{status.message}</p>
              <Button onClick={() => setStatus({ state: 'idle' })}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="stack">
              {status.state === 'error' && <Alert type="error">{status.message}</Alert>}
              <div className="form-grid">
                <TextField label="Your name" required autoComplete="name" maxLength={80} {...bind('name')} />
                <TextField label="Email" type="email" required autoComplete="email" maxLength={160} {...bind('email')} />
              </div>
              <TextField label="Subject" maxLength={140} {...bind('subject')} />
              <TextAreaField label="Message" required rows={6} maxLength={3000} {...bind('message')} />
              {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
              <div className="honeypot" aria-hidden="true">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set('website', e.target.value)} />
                </label>
              </div>
              <Checkbox
                checked={values.consent}
                onChange={(e) => set('consent', e.target.checked)}
                error={errors.consent}
                label={
                  <>
                    I agree that {SITE.company} may use my name and email only to reply to this message, as described in the{' '}
                    <Link to="/privacy">Privacy Policy</Link>.
                  </>
                }
              />
              <div>
                <Button type="submit" variant="primary" icon={Send} loading={status.state === 'loading'}>
                  Send message
                </Button>
              </div>
            </form>
          )}
        </div>
        <aside className="stack">
          <div className="card stack" style={{ '--gap': '12px' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{SITE.company}</h2>
            {SITE.address && (
              <p className="row small mb-0" style={{ alignItems: 'flex-start' }}>
                <MapPin size={16} aria-hidden="true" /> {SITE.address}
              </p>
            )}
            {SITE.email && (
              <a className="row small" href={`mailto:${SITE.email}`}>
                <Mail size={16} aria-hidden="true" /> {SITE.email}
              </a>
            )}
            {SITE.phone && (
              <a className="row small" href={`tel:${SITE.phone.replace(/\s/g, '')}`}>
                <Phone size={16} aria-hidden="true" /> {SITE.phone}
              </a>
            )}
            <p className="small muted mb-0">Response time: within 2 working days (Mon–Fri).</p>
          </div>
          <Alert type="info" title="Need to talk to someone now?">
            Tele-MANAS offers free, confidential mental health support 24×7: call <a href="tel:14416">14416</a> or{' '}
            <a href="tel:18008914416">1-800-891-4416</a>. In an emergency, call <a href="tel:112">112</a>.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
