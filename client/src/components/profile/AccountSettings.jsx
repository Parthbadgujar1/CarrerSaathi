import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, KeyRound, LogOut, Monitor, ShieldAlert, Smartphone, Trash2 } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { downloadBlob, userApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { setAccessToken, getErrorMessage, getFieldErrors } from '../../lib/http';
import { timeAgo } from '../../lib/format';
import { Alert, Badge, Button, ConfirmDialog, PasswordField, Switch, TextAreaField } from '../ui';
import { passwordHint } from '../../pages/auth/Register';

function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const mut = useMutation({
    mutationFn: () => authService.changePassword(form),
    onSuccess: (res) => {
      if (res.data?.accessToken) setAccessToken(res.data.accessToken);
      toast.success(res.message);
      setForm({ currentPassword: '', newPassword: '' });
      setErrors({});
    },
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
      noValidate
    >
      <h2 className="row" style={{ fontSize: '1.05rem', margin: 0, '--gap': '8px' }}>
        <KeyRound size={18} aria-hidden="true" /> Change password
      </h2>
      <div className="form-grid">
        <PasswordField label="Current password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} error={errors.currentPassword} />
        <PasswordField label="New password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} error={errors.newPassword} hint={passwordHint(form.newPassword)} />
      </div>
      <div>
        <Button type="submit" loading={mut.isPending} disabled={!form.currentPassword || !form.newPassword}>
          Update password
        </Button>
      </div>
    </form>
  );
}

function Devices() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const clear = useAuth((s) => s.clear);
  const { data } = useQuery({ queryKey: ['sessions'], queryFn: userApi.sessions });
  const [confirmAll, setConfirmAll] = useState(false);
  const revoke = useMutation({
    mutationFn: (id) => userApi.revokeSession(id),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const all = useMutation({
    mutationFn: authService.logoutAll,
    onSuccess: () => {
      clear();
      toast.success('Signed out from all devices.');
      navigate('/login', { replace: true });
    },
  });
  const label = (ua = '') => {
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
    return `${browser} on ${os}`;
  };
  return (
    <section className="card">
      <div className="card-header">
        <h2>Signed-in devices</h2>
        <Button size="sm" variant="danger-ghost" icon={LogOut} onClick={() => setConfirmAll(true)}>
          Sign out everywhere
        </Button>
      </div>
      <ul className="list-plain">
        {(data?.data || []).map((s) => (
          <li key={s._id} className="list-row">
            {/Mobile|Android|iPhone/.test(s.userAgent) ? <Smartphone size={18} aria-hidden="true" /> : <Monitor size={18} aria-hidden="true" />}
            <div className="flex-1">
              <div className="small bold">
                {label(s.userAgent)} {s.current && <Badge tone="success">This device</Badge>}
              </div>
              <div className="xs muted">
                Network {s.ipHint} · last active {timeAgo(s.lastUsedAt)}
              </div>
            </div>
            {!s.current && (
              <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === s._id} onClick={() => revoke.mutate(s._id)}>
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={() => all.mutate()}
        loading={all.isPending}
        title="Sign out from all devices?"
        message="You will be signed out everywhere, including this browser."
        confirmLabel="Sign out everywhere"
      />
    </section>
  );
}

function Preferences() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const mut = useMutation({
    mutationFn: (body) => userApi.updatePreferences(body),
    onSuccess: (res) => {
      setUser(res.data.user);
      toast.success(res.message);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  return (
    <section className="card stack">
      <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Email & privacy preferences</h2>
      <Switch label="Announcement emails" description="Occasional updates about sessions and opportunities. Every email has an unsubscribe link." checked={Boolean(user.consents?.marketingEmails)} onChange={(v) => mut.mutate({ marketingEmails: v })} disabled={mut.isPending} />
      <Switch label="Activity notifications by email" description="Account and security emails are always sent." checked={user.preferences?.emailNotifications !== false} onChange={(v) => mut.mutate({ emailNotifications: v })} disabled={mut.isPending} />
      {user.role === 'student' && (
        <Switch label="Share wellness summary with my mentor" description="Averages only — your journal stays private." checked={Boolean(user.consents?.wellnessShareWithMentor)} onChange={(v) => mut.mutate({ wellnessShareWithMentor: v })} disabled={mut.isPending} />
      )}
    </section>
  );
}

function DataRights() {
  const navigate = useNavigate();
  const clear = useAuth((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [downloading, setDownloading] = useState(false);
  const del = useMutation({
    mutationFn: () => userApi.requestDeletion({ password, reason }),
    onSuccess: (res) => {
      clear();
      toast.success(res.message, { duration: 8000 });
      navigate('/', { replace: true });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const download = async () => {
    setDownloading(true);
    try {
      downloadBlob(await userApi.exportData(), 'careersaathi-my-data.json');
      toast.success('Your data export has been downloaded.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };
  return (
    <section className="card stack">
      <h2 className="row" style={{ fontSize: '1.05rem', margin: 0, '--gap': '8px' }}>
        <ShieldAlert size={18} aria-hidden="true" /> Your data
      </h2>
      <p className="small muted mb-0">Download a copy of everything we store about you, or permanently delete your account.</p>
      <div className="row">
        <Button icon={Download} loading={downloading} onClick={download}>
          Download my data
        </Button>
        <Button variant="danger-ghost" icon={Trash2} onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => del.mutate()}
        loading={del.isPending}
        danger
        title="Delete your account?"
        message="Your account will be deactivated now and all your data permanently erased after 7 days. Sign in before then to cancel."
        confirmLabel="Delete my account"
        confirmText="DELETE"
      >
        <PasswordField label="Confirm with your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <TextAreaField label="Reason (optional)" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} hint="Helps us improve" />
      </ConfirmDialog>
      <Alert type="info">You can also email a deletion request to our team via the Contact page.</Alert>
    </section>
  );
}

export function AccountSettings() {
  return (
    <div className="stack" style={{ '--gap': '20px', maxWidth: 880 }}>
      <ChangePassword />
      <Preferences />
      <Devices />
      <DataRights />
    </div>
  );
}
