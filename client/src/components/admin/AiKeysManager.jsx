import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { KeyRound, Plus, Save, Trash2 } from 'lucide-react';
import { adminApi } from '../../services/api';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { fmtDate } from '../../lib/format';

const nice = (p) => ({ groq: 'Groq', gemini: 'Google Gemini', openai: 'OpenAI' }[p] || p);
import { Alert, Badge, Button, ConfirmDialog, ErrorState, PasswordField, SelectField, Spinner, TextField } from '../ui';

const HINT = {
  groq: 'Free tier available at console.groq.com — fast and cost-effective.',
  gemini: 'Get a key at aistudio.google.com/apikey.',
  openai: 'Create a key at platform.openai.com/api-keys.',
};

/** Add, rotate and remove AI provider keys from the portal. Keys are encrypted and never shown again. */
export function AiKeysManager() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-ai-keys'], queryFn: adminApi.aiKeys });
  const [form, setForm] = useState({ provider: 'groq', key: '', label: '' });
  const [errors, setErrors] = useState({});
  const [removing, setRemoving] = useState(null);
  const [models, setModels] = useState(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-ai-keys'] });
    qc.invalidateQueries({ queryKey: ['admin-ai'] });
  };
  const add = useMutation({
    mutationFn: () => adminApi.aiKeyAdd(form),
    onSuccess: (res) => {
      toast.success(res.message);
      setForm({ ...form, key: '', label: '' });
      setErrors({});
      refresh();
    },
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });
  const remove = useMutation({
    mutationFn: ({ provider, id }) => adminApi.aiKeyRemove(provider, id),
    onSuccess: (res) => (toast.success(res.message), setRemoving(null), refresh()),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const saveModels = useMutation({
    mutationFn: () => adminApi.aiModels(models),
    onSuccess: (res) => (toast.success(res.message), setModels(null), refresh()),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const providers = data.data;
  const modelValues = models || Object.fromEntries(providers.map((p) => [p.provider, p.model || '']));

  return (
    <section className="card stack" aria-labelledby="keys-h">
      <div>
        <h2 id="keys-h" className="row" style={{ fontSize: '1.05rem', margin: 0, '--gap': '8px' }}>
          <KeyRound size={18} aria-hidden="true" /> API keys
        </h2>
        <p className="small muted mb-0">
          Add one or more keys per provider — they rotate automatically and bad keys are skipped. Keys are encrypted and only the last 4 characters are ever shown. Keys set in the server's <code>.env</code> keep working alongside these.
        </p>
      </div>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
        noValidate
      >
        <div className="form-grid">
          <SelectField label="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} options={[{ value: 'groq', label: 'Groq' }, { value: 'gemini', label: 'Google Gemini' }, { value: 'openai', label: 'OpenAI' }]} hint={HINT[form.provider]} />
          <TextField label="Label (optional)" placeholder="e.g. Team key 1" maxLength={40} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <PasswordField label="API key" autoComplete="off" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} error={errors.key} placeholder="Paste the key" />
        </div>
        <div>
          <Button type="submit" variant="primary" icon={Plus} loading={add.isPending} disabled={form.key.trim().length < 12}>Add key</Button>
        </div>
      </form>

      <div className="stack" style={{ '--gap': '14px' }}>
        {providers.map((p) => (
          <div key={p.provider} style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div className="row-between mb-1">
              <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{nice(p.provider)}</h3>
              <Badge tone={p.keys.length + p.envKeys.length ? 'success' : undefined}>{p.keys.length + p.envKeys.length} key{p.keys.length + p.envKeys.length === 1 ? '' : 's'}</Badge>
            </div>
            <ul className="list-plain">
              {p.envKeys.map((k, i) => (
                <li key={`env-${i}`} className="list-row">
                  <code className="small">••••{k.tail}</code>
                  <span className="xs muted flex-1">From server .env (edit the file to change)</span>
                </li>
              ))}
              {p.keys.map((k) => (
                <li key={k.id} className="list-row">
                  <code className="small">••••{k.tail}</code>
                  <span className="small flex-1">{k.label || 'Unnamed key'} <span className="xs muted">· added {fmtDate(k.addedAt)}</span></span>
                  <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setRemoving({ provider: p.provider, ...k })} aria-label={`Remove ${nice(p.provider)} key ending ${k.tail}`}>Remove</Button>
                </li>
              ))}
              {!p.keys.length && !p.envKeys.length && <li className="small muted">No keys yet.</li>}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <h3 style={{ fontSize: '0.98rem' }}>Models</h3>
        <p className="xs muted">Leave blank to use the default. Check each provider's current model names before changing.</p>
        <div className="form-grid">
          {providers.map((p) => (
            <TextField key={p.provider} label={nice(p.provider)} placeholder={p.defaultModel} value={modelValues[p.provider]} onChange={(e) => setModels({ ...modelValues, [p.provider]: e.target.value })} maxLength={80} />
          ))}
        </div>
        <div className="mt-1">
          <Button icon={Save} disabled={!models} loading={saveModels.isPending} onClick={() => saveModels.mutate()}>Save models</Button>
        </div>
      </div>

      <Alert type="info">After adding a key, press <strong>Test</strong> on the provider list below to confirm it works. If every key fails, students still get plans from the built-in library.</Alert>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate({ provider: removing.provider, id: removing.id })}
        loading={remove.isPending}
        danger
        title="Remove this API key?"
        message={`The ${nice(removing?.provider || '')} key ending ${removing?.tail} will be deleted from the platform. This does not revoke it with the provider.`}
        confirmLabel="Remove key"
      />
    </section>
  );
}
