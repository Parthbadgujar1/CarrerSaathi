import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Activity, Bot, CheckCircle2, FileClock, Inbox, Mail, RefreshCw, Save, Settings, ShieldCheck, Trash2, UserX, XCircle } from 'lucide-react';
import { adminApi, healthApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { fmtDateTime, timeAgo, titleCase } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { AiKeysManager } from '../../components/admin/AiKeysManager';
import { Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Pagination, Spinner, StatCard, Switch, Tabs, TextField } from '../../components/ui';

function Health() {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ['health'], queryFn: healthApi.ready, refetchInterval: 30_000 });
  if (isLoading) return <Spinner />;
  const c = data.checks;
  const Row = ({ label, ok, children }) => (
    <li className="list-row" style={{ alignItems: 'flex-start' }}>
      {ok ? <CheckCircle2 size={18} color="var(--success)" aria-label="Healthy" /> : <XCircle size={18} color="var(--danger)" aria-label="Problem" />}
      <div className="flex-1">
        <div className="bold small">{label}</div>
        <div className="xs muted">{children}</div>
      </div>
      <Badge tone={ok ? 'success' : 'danger'}>{ok ? 'Healthy' : 'Attention'}</Badge>
    </li>
  );
  return (
    <div className="stack">
      <div className="row-between">
        <Badge tone={data.status === 'ok' ? 'success' : data.status === 'degraded' ? 'warning' : 'danger'}>Overall: {data.status}</Badge>
        <Button size="sm" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>Refresh</Button>
      </div>
      <ul className="list-plain card">
        <Row label="Database (MongoDB)" ok={c.database.ok}>State: {c.database.state}. If down, the API returns 503s and retries automatically.</Row>
        <Row label="Email" ok={c.email.ok}>
          Transport: {c.email.transport === 'smtp' ? 'SMTP' : 'development file outbox (server/storage/mail)'} · queued {c.email.queued ?? '—'} · failed {c.email.failed ?? '—'}
        </Row>
        <Row label="AI providers" ok>
          Configured: {c.ai.providersConfigured.length ? c.ai.providersConfigured.join(' → ') : 'none'} · fallback: {c.ai.fallback}
        </Row>
        <Row label="Realtime (Socket.IO)" ok={c.realtime.ok}>Chat and notifications fall back to polling if unavailable.</Row>
        <Row label="Server process" ok={c.process.ok}>
          Node {c.process.node} · uptime {Math.round(c.process.uptimeSeconds / 60)} min · memory {c.process.rssMB} MB · event-loop lag {c.process.eventLoopLagMs} ms
        </Row>
      </ul>
    </div>
  );
}

function AiPanel() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-ai'], queryFn: adminApi.ai, refetchInterval: 30_000 });
  const [testing, setTesting] = useState(null);
  const [results, setResults] = useState({});
  const [confirmClear, setConfirmClear] = useState(false);
  const clear = useMutation({ mutationFn: adminApi.aiClearCache, onSuccess: (r) => (toast.success(r.message), setConfirmClear(false), qc.invalidateQueries({ queryKey: ['admin-ai'] })) });
  const test = async (provider) => {
    setTesting(provider);
    try {
      const res = await adminApi.aiTest(provider);
      setResults((r) => ({ ...r, [provider]: res.data }));
      refetch();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setTesting(null);
    }
  };
  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const a = data.data;
  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      {!a.providers.some((p) => p.configured) && (
        <Alert type="info" title="No AI keys configured — the platform is fully working on its built-in library">
          Add a key below — no restart needed.
        </Alert>
      )}
      <div className="grid-4">
        <StatCard icon={Bot} label="AI requests (24h)" value={a.last24h.total} />
        <StatCard icon={ShieldCheck} label="Served free (cache/library/rules)" value={`${a.last24h.savedByCacheOrLibraryPct}%`} tone="success" />
        <StatCard icon={Activity} label="Paid AI calls (24h)" value={a.last24h.ai || 0} tone="warning" />
        <StatCard icon={FileClock} label="Cached responses" value={a.cacheEntries} tone="info" />
      </div>
      <AiKeysManager />
      <section className="card">
        <div className="card-header">
          <h2>Providers (tried in this order)</h2>
          <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setConfirmClear(true)}>Clear AI cache</Button>
        </div>
        <ol className="list-plain">
          {a.providers.map((p, i) => (
            <li key={p.provider} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span className="badge">{i + 1}</span>
              <div className="flex-1">
                <div className="row" style={{ '--gap': '8px' }}>
                  <span className="bold">{{ groq: 'Groq', gemini: 'Google Gemini', openai: 'OpenAI' }[p.provider] || p.provider}</span>
                  <span className="xs muted">model {p.model}</span>
                  {!p.configured && <Badge>No key</Badge>}
                </div>
                {p.keys.map((k) => (
                  <div key={k.label} className="xs row" style={{ '--gap': '8px', marginTop: 4 }}>
                    <Badge tone={k.healthy ? 'success' : 'danger'}>{k.healthy ? 'Healthy' : `Cooling down ${k.cooldownSeconds}s`}</Badge>
                    <span className="muted">{k.label} · {k.calls} calls · {k.errors} errors{k.lastOkAt ? ` · last OK ${timeAgo(k.lastOkAt)}` : ''}</span>
                    {k.lastError && <span style={{ color: 'var(--danger)' }}>{k.lastError}</span>}
                  </div>
                ))}
                {results[p.provider] && (
                  <div className="xs mt-1">
                    Test: {results[p.provider].ok ? <Badge tone="success">OK in {results[p.provider].latencyMs} ms</Badge> : <Badge tone="danger">{results[p.provider].error}</Badge>}
                  </div>
                )}
              </div>
              {p.configured && <Button size="sm" loading={testing === p.provider} onClick={() => test(p.provider)}>Test</Button>}
            </li>
          ))}
        </ol>
        <p className="xs muted mb-0">
          Cost controls: library-first matching, a 30-day shared cache with bucketed inputs, per-user daily limits ({a.limits.student} for students / {a.limits.staff} for staff), capped output tokens, key rotation and automatic circuit breakers.
        </p>
      </section>
      <ConfirmDialog open={confirmClear} onClose={() => setConfirmClear(false)} onConfirm={() => clear.mutate()} loading={clear.isPending} title="Clear the AI cache?" message="Future requests will call AI providers again until the cache rebuilds. Saved student roadmaps are not affected." confirmLabel="Clear cache" />
    </div>
  );
}

function SettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.settings });
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (data && !form) setForm(data.data);
  }, [data, form]);
  const save = useMutation({
    mutationFn: () => adminApi.updateSettings({ ...form, aiDailyLimitStudent: Number(form.aiDailyLimitStudent), aiDailyLimitStaff: Number(form.aiDailyLimitStaff) }),
    onSuccess: (r) => {
      toast.success(r.message);
      setForm(r.data);
      qc.invalidateQueries({ queryKey: ['public-config'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  if (isLoading || !form) return <Spinner />;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="stack" style={{ maxWidth: 760, '--gap': '20px' }}>
      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Access</h2>
        <Switch label="Student registration open" checked={form.registrationOpen} onChange={(v) => set('registrationOpen', v)} />
        <Switch label="Mentor applications open" checked={form.mentorApplicationsOpen} onChange={(v) => set('mentorApplicationsOpen', v)} />
      </section>
      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>AI</h2>
        <Switch label="AI features enabled" description="When off, the planner and assistant use the curated library and built-in guide only (zero cost)." checked={form.aiEnabled} onChange={(v) => set('aiEnabled', v)} />
        <div className="form-grid">
          <TextField label="Daily AI limit per student" type="number" min={0} max={500} value={form.aiDailyLimitStudent} onChange={(e) => set('aiDailyLimitStudent', e.target.value)} />
          <TextField label="Daily AI limit per mentor/admin" type="number" min={0} max={2000} value={form.aiDailyLimitStaff} onChange={(e) => set('aiDailyLimitStaff', e.target.value)} />
        </div>
      </section>
      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Dashboard banner</h2>
        <TextField label="Announcement banner (shown to all signed-in users)" maxLength={240} value={form.announcementBanner} onChange={(e) => set('announcementBanner', e.target.value)} hint="Leave empty to hide" />
      </section>
      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Skill NexGen family links</h2>
        <p className="small muted mb-0">Shown to students under Opportunities → Explore platforms.</p>
        <div className="form-grid">
          {Object.keys(form.ecosystemLinks).map((k) => (
            <TextField key={k} label={{ skillnexgen: 'Skill NexGen URL', kaushalsaathi: 'KaushalSaathi URL', internsaathi: 'InternSaathi URL', naukrisaathi: 'NaukriSaathi URL' }[k]} type="url" placeholder="https://…" value={form.ecosystemLinks[k]} onChange={(e) => set('ecosystemLinks', { ...form.ecosystemLinks, [k]: e.target.value })} />
          ))}
        </div>
      </section>
      <div>
        <Button variant="primary" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button>
      </div>
    </div>
  );
}

function PagedList({ queryKey, fetcher, statusOptions, render, empty }) {
  const [status, setStatus] = useState(statusOptions?.[0]?.[0] || '');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: [...queryKey, status, page], queryFn: () => fetcher({ status, page }) });
  return (
    <>
      {statusOptions && (
        <div className="segmented mb-2" role="group" aria-label="Filter">
          {statusOptions.map(([v, l]) => (
            <button key={v || 'all'} type="button" aria-pressed={status === v} onClick={() => (setStatus(v), setPage(1))}>{l}</button>
          ))}
        </div>
      )}
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : data.data.items.length === 0 ? <div className="card"><EmptyState title={empty} /></div> : (
        <>
          {render(data.data.items, refetch)}
          <Pagination pagination={data.data.pagination} onPage={setPage} />
        </>
      )}
    </>
  );
}

function InboxPanel() {
  const resolve = async (id, refetch) => {
    try {
      await adminApi.updateContactMessage(id, 'resolved');
      refetch();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };
  return (
    <PagedList
      queryKey={['admin-inbox']}
      fetcher={adminApi.contactMessages}
      statusOptions={[['new', 'New'], ['resolved', 'Resolved'], ['', 'All']]}
      empty="No messages"
      render={(items, refetch) => (
        <div className="stack">
          {items.map((m) => (
            <article key={m._id} className="card">
              <div className="row-between">
                <div>
                  <div className="bold">{m.subject || '(no subject)'}</div>
                  <div className="xs muted">{m.name} · <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'Your message to CareerSaathi'}`)}`}>{m.email}</a> · {fmtDateTime(m.createdAt)}</div>
                </div>
                {m.status === 'new' ? <Button size="sm" icon={CheckCircle2} onClick={() => resolve(m._id, refetch)}>Mark resolved</Button> : <Badge tone="success">Resolved</Badge>}
              </div>
              <p className="small mt-1 mb-0 pre-line">{m.message}</p>
            </article>
          ))}
        </div>
      )}
    />
  );
}

function DeletionPanel() {
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Alert type="info" className="mb-2">Accounts are erased automatically 7 days after a request unless the user signs in to cancel. You can process a request early here.</Alert>
      <PagedList
        queryKey={['admin-deletions']}
        fetcher={adminApi.deletionRequests}
        statusOptions={[['pending', 'Pending'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]}
        empty="No requests"
        render={(items, refetch) => (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">User</th><th scope="col">Reason</th><th scope="col">Requested</th><th scope="col">Scheduled</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r._id}>
                      <td className="small">{r.email}</td>
                      <td className="xs">{r.reason || '—'}</td>
                      <td className="xs muted">{fmtDateTime(r.createdAt)}</td>
                      <td className="xs muted">{fmtDateTime(r.scheduledFor)}</td>
                      <td>{r.status === 'pending' ? <Button size="sm" variant="danger-ghost" icon={UserX} onClick={() => setConfirm({ r, refetch })}>Erase now</Button> : <Badge>{titleCase(r.status)}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        loading={busy}
        danger
        title="Erase this account now?"
        message={`All data for ${confirm?.r.email} will be permanently deleted immediately.`}
        confirmLabel="Erase permanently"
        onConfirm={async () => {
          setBusy(true);
          try {
            const res = await adminApi.processDeletion(confirm.r._id);
            toast.success(res.message);
            confirm.refetch();
            setConfirm(null);
          } catch (e) {
            toast.error(getErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function EmailPanel() {
  return (
    <PagedList
      queryKey={['admin-emails']}
      fetcher={adminApi.emails}
      statusOptions={[['', 'All'], ['queued', 'Queued'], ['sent', 'Sent'], ['failed', 'Failed']]}
      empty="No emails"
      render={(items, refetch) => (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">To</th><th scope="col">Subject</th><th scope="col">Status</th><th scope="col">Attempts</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {items.map((m) => (
                <tr key={m._id}>
                  <td className="xs">{m.to}</td>
                  <td className="small">{m.subject}{m.lastError && <div className="xs" style={{ color: 'var(--danger)' }}>{m.lastError}</div>}</td>
                  <td><Badge tone={m.status === 'sent' ? 'success' : m.status === 'failed' ? 'danger' : 'warning'}>{m.status}{m.transport === 'file' ? ' (dev file)' : ''}</Badge></td>
                  <td className="small">{m.attempts}</td>
                  <td className="xs muted">{fmtDateTime(m.createdAt)}</td>
                  <td>{m.status === 'failed' && <Button size="sm" icon={RefreshCw} onClick={async () => { await adminApi.retryEmail(m._id); refetch(); }}>Retry</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  );
}

function AuditPanel() {
  return (
    <PagedList
      queryKey={['admin-audit']}
      fetcher={adminApi.auditLogs}
      empty="No audit entries yet"
      render={(items) => (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Details</th></tr></thead>
            <tbody>
              {items.map((l) => (
                <tr key={l._id}>
                  <td className="xs muted nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="xs">{l.actorEmail}</td>
                  <td><code className="xs">{l.action}</code></td>
                  <td className="xs">{l.targetType ? `${l.targetType} ${l.targetId?.slice(-6)}` : '—'}</td>
                  <td className="xs muted" style={{ maxWidth: 320 }}>{l.meta ? JSON.stringify(l.meta).slice(0, 140) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  );
}

export function AdminSystem() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'health';
  return (
    <>
      <PageTitle title="System" subtitle="Health, AI, platform settings, inbox, privacy requests and audit trail." />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'health', label: 'Health', icon: Activity },
          { value: 'ai', label: 'AI', icon: Bot },
          { value: 'settings', label: 'Settings', icon: Settings },
          { value: 'inbox', label: 'Inbox', icon: Inbox },
          { value: 'privacy', label: 'Data requests', icon: UserX },
          { value: 'email', label: 'Email', icon: Mail },
          { value: 'audit', label: 'Audit log', icon: FileClock },
        ]}
      />
      {tab === 'health' && <Health />}
      {tab === 'ai' && <AiPanel />}
      {tab === 'settings' && <SettingsPanel />}
      {tab === 'inbox' && <InboxPanel />}
      {tab === 'privacy' && <DeletionPanel />}
      {tab === 'email' && <EmailPanel />}
      {tab === 'audit' && <AuditPanel />}
    </>
  );
}
