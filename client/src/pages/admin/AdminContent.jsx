import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Archive, Briefcase, Compass, Download, Eye, EyeOff, FileText, Hash, Megaphone, MessagesSquare, Pencil, Plus, RotateCcw, Send, Trash2, Upload } from 'lucide-react';
import { adminApi, communityApi, roadmapApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { fmtDate } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Alert, Badge, Button, Checkbox, ConfirmDialog, EmptyState, ErrorState, Modal, SelectField, Spinner, Tabs, TextAreaField, TextField } from '../../components/ui';
import { OpportunitiesManager } from '../shared/OpportunitiesManager';
import { BULK_TEMPLATE, CATEGORIES, SINGLE_TEMPLATE, downloadText, formatRoadmap, parseBulk, parseRoadmapText } from '../../lib/roadmapText';

const EDITABLE = ['title', 'slug', 'category', 'summary', 'description', 'icon', 'duration', 'suitableFor', 'roles', 'skills', 'keywords', 'careerKit', 'phases', 'isPublished'];

const FORMAT_HELP = `Title: Roadmap name
Category: ${CATEGORIES.join(' | ')}
Duration / Summary / Roles / Skills / Keywords: free text (lists are comma-separated)
Kit: shortKey | Checklist item        (optional career-kit items)

## Phase title | 4 weeks
- Step title | Short description
- Project: name | Description | project
  + Resource title | https://link | course`;

const tally = (data) => ({
  phases: data.phases.length,
  steps: data.phases.reduce((n, p) => n + p.steps.length, 0),
  resources: data.phases.reduce((n, p) => n + p.steps.reduce((m, s) => m + s.resources.length, 0), 0),
});

/** Plain-text roadmap editor with live validation and an outline preview — no JSON. */
function RoadmapEditor({ initial, onClose }) {
  const qc = useQueryClient();
  const [text, setText] = useState(() => (initial ? formatRoadmap(initial) : SINGLE_TEMPLATE));
  const [serverErrors, setServerErrors] = useState([]);
  const parsed = useMemo(() => parseRoadmapText(text), [text]);
  const stats = tally(parsed.data);

  const save = useMutation({
    mutationFn: () => (initial ? roadmapApi.adminUpdate(initial._id, parsed.data) : roadmapApi.adminCreate(parsed.data)),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['roadmaps'] });
      qc.invalidateQueries({ queryKey: ['admin-roadmaps'] });
      onClose();
    },
    onError: (err) => {
      setServerErrors(err.response?.data?.error?.details || []);
      toast.error(getErrorMessage(err));
    },
  });

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={initial ? `Edit roadmap: ${initial.title}` : 'New roadmap'}
      footer={
        <>
          <Button icon={Download} onClick={() => downloadText('roadmap-template.txt', SINGLE_TEMPLATE)}>Download template</Button>
          <span className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={parsed.errors.length > 0} onClick={() => save.mutate()}>
            {initial ? 'Save changes' : 'Create roadmap'}
          </Button>
        </>
      }
    >
      <div className="grid-2 grid-top" style={{ gap: 20 }}>
        <div className="stack" style={{ '--gap': '10px' }}>
          <label htmlFor="rm-text" className="label">Roadmap text</label>
          <textarea id="rm-text" className="textarea" spellCheck={false} value={text} onChange={(e) => (setText(e.target.value), setServerErrors([]))} style={{ minHeight: 440, fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.55 }} />
          <details className="small">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How to write it</summary>
            <pre className="small muted" style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{FORMAT_HELP}</pre>
            <p className="xs muted mb-0">Step progress is tracked by step name, so avoid renaming steps of roadmaps students already follow.</p>
          </details>
        </div>
        <div className="stack" style={{ '--gap': '12px' }}>
          {parsed.errors.length > 0 ? (
            <Alert type="error" title={`${parsed.errors.length} thing${parsed.errors.length > 1 ? 's' : ''} to fix`}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{parsed.errors.map((e) => <li key={e} className="small">{e}</li>)}</ul>
            </Alert>
          ) : (
            <Alert type="success" title="Looks good">{stats.phases} phases · {stats.steps} steps · {stats.resources} resources</Alert>
          )}
          {parsed.warnings.length > 0 && (
            <Alert type="warning"><ul style={{ margin: 0, paddingLeft: 18 }}>{parsed.warnings.map((w) => <li key={w} className="small">{w}</li>)}</ul></Alert>
          )}
          {serverErrors.length > 0 && (
            <Alert type="error" title="The server rejected some fields">
              <ul style={{ margin: 0, paddingLeft: 18 }}>{serverErrors.slice(0, 6).map((e, i) => <li key={i} className="small">{e.field}: {e.message}</li>)}</ul>
            </Alert>
          )}
          <div className="card" style={{ padding: 14, maxHeight: 340, overflow: 'auto' }} aria-label="Preview">
            <div className="bold">{parsed.data.title || 'Untitled roadmap'}</div>
            <div className="xs muted mb-1">{[parsed.data.category, parsed.data.duration].filter(Boolean).join(' · ')}</div>
            {parsed.data.phases.map((p, i) => (
              <div key={i} className="mt-1">
                <div className="small bold">Phase {i + 1}: {p.title} <span className="muted">{p.duration && `· ${p.duration}`}</span></div>
                <ul className="small muted" style={{ margin: '2px 0 0', paddingLeft: 18 }}>
                  {p.steps.map((s) => (
                    <li key={s.key}>{s.title}{s.isProject ? ' 🛠' : ''}{s.resources.length ? ` — ${s.resources.length} link${s.resources.length > 1 ? 's' : ''}` : ''}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const STATUS_TONE = { created: 'success', updated: 'info', skipped: undefined, failed: 'danger' };

/** Bulk upload: .txt/.md file(s) or pasted text, with a downloadable template and a validated preview. */
function BulkModal({ onClose }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [mode, setMode] = useState('upsert');
  const [results, setResults] = useState(null);
  const fileRef = useRef(null);
  const items = useMemo(() => (text.trim() ? parseBulk(text) : []), [text]);
  const valid = items.filter((i) => i.errors.length === 0);

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    const parts = await Promise.all(files.map((f) => f.text()));
    setText((t) => [t.trim(), ...parts].filter(Boolean).join('\n===\n'));
    setResults(null);
    e.target.value = '';
  };
  const run = useMutation({
    mutationFn: () => roadmapApi.adminBulk(valid.map((i) => i.data), mode),
    onSuccess: (res) => {
      setResults(res.data.results);
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['roadmaps'] });
      qc.invalidateQueries({ queryKey: ['admin-roadmaps'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title="Bulk upload roadmaps"
      footer={
        results ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button icon={Download} onClick={() => downloadText('roadmaps-bulk-template.txt', BULK_TEMPLATE)}>Download template</Button>
            <span className="flex-1" />
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon={Upload} loading={run.isPending} disabled={!valid.length} onClick={() => run.mutate()}>
              Import {valid.length || ''} roadmap{valid.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      {results ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Roadmap</th><th scope="col">Result</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.index}>
                  <td>{r.title}</td>
                  <td><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> {r.message && <span className="xs muted">{r.message}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stack">
          <Alert type="info" title="Three easy steps">
            1) Download the template and add your roadmaps in plain text. 2) Upload the file (or paste the text below). 3) Review the check and import. Put a line with only <code>===</code> between roadmaps.
          </Alert>
          <div className="row">
            <input ref={fileRef} type="file" accept=".txt,.md,text/plain" multiple hidden onChange={onFiles} aria-label="Choose roadmap files" />
            <Button icon={FileText} onClick={() => fileRef.current?.click()}>Choose file(s)…</Button>
            <SelectField label={<span className="sr-only">If a roadmap already exists</span>} value={mode} onChange={(e) => setMode(e.target.value)} options={[{ value: 'upsert', label: 'Update existing roadmaps with the same name' }, { value: 'create', label: 'Skip existing — only add new ones' }]} />
            {text && <Button variant="ghost" onClick={() => setText('')}>Clear</Button>}
          </div>
          <TextAreaField label="…or paste text here" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Title: My roadmap&#10;Category: Technology&#10;&#10;## Phase one | 4 weeks&#10;- First step | What to learn" />
          {items.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">#</th><th scope="col">Roadmap</th><th scope="col">Size</th><th scope="col">Check</th></tr></thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.index}>
                      <td>{it.index}</td>
                      <td className="bold small">{it.data.title || '(no title)'}</td>
                      <td className="xs muted">{tally(it.data).phases} phases · {tally(it.data).steps} steps</td>
                      <td>
                        {it.errors.length ? (
                          <div><Badge tone="danger">Fix needed</Badge><ul className="xs" style={{ margin: '4px 0 0', paddingLeft: 16 }}>{it.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
                        ) : (
                          <Badge tone="success">Ready</Badge>
                        )}
                        {it.warnings.map((w) => <div key={w} className="xs muted">{w}</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function RoadmapsAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [loadingSlug, setLoadingSlug] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-roadmaps'], queryFn: roadmapApi.adminList });
  const del = useMutation({
    mutationFn: (id) => roadmapApi.adminDelete(id),
    onSuccess: (res) => {
      toast.success(res.message);
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['admin-roadmaps'] });
      qc.invalidateQueries({ queryKey: ['roadmaps'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const openEditor = async (r) => {
    setLoadingSlug(r.slug);
    try {
      const res = await roadmapApi.get(r.slug);
      setEditing(res.data.roadmap);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoadingSlug(null);
    }
  };
  const togglePublish = async (r) => {
    try {
      const res = await roadmapApi.get(r.slug);
      const body = Object.fromEntries(EDITABLE.map((k) => [k, res.data.roadmap[k]]));
      await roadmapApi.adminUpdate(r._id, { ...body, isPublished: !r.isPublished });
      toast.success(r.isPublished ? 'Roadmap hidden from students' : 'Roadmap published');
      qc.invalidateQueries({ queryKey: ['admin-roadmaps'] });
      qc.invalidateQueries({ queryKey: ['roadmaps'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };
  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <>
      <div className="row-between mb-2">
        <p className="small muted mb-0">Curated roadmaps power the library, the Career Compass quiz and the AI fallback.</p>
        <div className="row">
          <Button icon={Upload} onClick={() => setBulk(true)}>Bulk upload</Button>
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New roadmap</Button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Roadmap</th>
              <th scope="col">Category</th>
              <th scope="col">Steps</th>
              <th scope="col">Learners</th>
              <th scope="col">Avg progress</th>
              <th scope="col">Updated</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((r) => (
              <tr key={r._id}>
                <td>
                  <div className="bold small">{r.title}</div>
                  <div className="row" style={{ '--gap': '4px' }}>
                    <Badge tone={r.source === 'system' ? undefined : 'primary'}>{r.source}</Badge>
                    {!r.isPublished && <Badge tone="warning">Hidden</Badge>}
                  </div>
                </td>
                <td className="xs">{r.category}</td>
                <td className="small">{r.totalSteps}</td>
                <td className="small">{r.learners}</td>
                <td className="small">{r.avgProgress}%</td>
                <td className="xs muted">{fmtDate(r.updatedAt)}</td>
                <td>
                  <div className="row" style={{ '--gap': '4px', flexWrap: 'nowrap' }}>
                    <Button size="sm" variant="ghost" icon={Pencil} loading={loadingSlug === r.slug} onClick={() => openEditor(r)}>Edit</Button>
                    <Button size="sm" variant="ghost" icon={r.isPublished ? EyeOff : Eye} onClick={() => togglePublish(r)} aria-label={r.isPublished ? `Hide ${r.title}` : `Publish ${r.title}`} />
                    <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(r)} aria-label={`Delete ${r.title}`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <RoadmapEditor initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {bulk && <BulkModal onClose={() => setBulk(false)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => del.mutate(deleting._id)}
        loading={del.isPending}
        danger
        title={`Delete “${deleting?.title}”?`}
        message={`${deleting?.learners || 0} student(s) follow this roadmap and will lose their progress. Consider hiding it instead. Built-in roadmaps are restored automatically on the next server start.`}
        confirmLabel="Delete roadmap"
        confirmText="DELETE"
      />
    </>
  );
}

function CommunityForm({ initial, onClose }) {
  const qc = useQueryClient();
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'list', '', ''], queryFn: () => roadmapApi.list() });
  const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '', track: initial?.track || '', tags: (initial?.tags || []).join(', ') });
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name, description: form.description, track: form.track, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8) };
      return initial ? communityApi.update(initial._id, body) : communityApi.create(body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['communities'] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit community' : 'New community'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={form.name.trim().length < 3} onClick={() => save.mutate()}>{initial ? 'Save' : 'Create'}</Button></>}>
      <div className="stack">
        <TextField label="Name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
        <TextAreaField label="Description" rows={3} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <SelectField label="Related career track" placeholder="General" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} options={(roadmaps?.data || []).map((r) => ({ value: r.slug, label: r.title }))} />
        <TextField label="Tags" hint="Comma separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
      </div>
    </Modal>
  );
}

function CommunitiesAdmin() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('active');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['communities', 'admin', status], queryFn: () => communityApi.list({ status, limit: 100 }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['communities'] });
  const update = useMutation({ mutationFn: ({ id, s }) => communityApi.update(id, { status: s }), onSuccess: (res) => (toast.success(res.message), refresh()), onError: (e) => toast.error(getErrorMessage(e)) });
  const del = useMutation({ mutationFn: (id) => communityApi.remove(id), onSuccess: (res) => (toast.success(res.message), setDeleting(null), refresh()), onError: (e) => toast.error(getErrorMessage(e)) });
  return (
    <>
      <div className="row-between mb-2">
        <div className="segmented" role="group" aria-label="Community status">
          <button type="button" aria-pressed={status === 'active'} onClick={() => setStatus('active')}>Active</button>
          <button type="button" aria-pressed={status === 'archived'} onClick={() => setStatus('archived')}>Archived</button>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New community</Button>
      </div>
      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? <Spinner /> : data.data.items.length === 0 ? (
        <div className="card"><EmptyState icon={Hash} title="No communities" /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th scope="col">Community</th><th scope="col">Members</th><th scope="col">Type</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {data.data.items.map((c) => (
                <tr key={c._id}>
                  <td><div className="bold small">#{c.name}</div><div className="xs muted">{c.description}</div></td>
                  <td className="small">{c.memberCount}</td>
                  <td>{c.isOfficial ? <Badge tone="primary">Official</Badge> : <Badge>Student-created</Badge>}</td>
                  <td className="xs muted">{fmtDate(c.createdAt)}</td>
                  <td>
                    <div className="row" style={{ '--gap': '4px', flexWrap: 'nowrap' }}>
                      <Button size="sm" variant="primary" icon={MessagesSquare} to={`/admin/communities/${c._id}`}>View chat</Button>
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`} />
                      {status === 'active' ? (
                        <Button size="sm" variant="ghost" icon={Archive} onClick={() => update.mutate({ id: c._id, s: 'archived' })} aria-label={`Archive ${c.name}`} />
                      ) : (
                        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => update.mutate({ id: c._id, s: 'active' })} aria-label={`Restore ${c.name}`} />
                      )}
                      <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CommunityForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => del.mutate(deleting._id)}
        loading={del.isPending}
        danger
        title={`Delete #${deleting?.name}?`}
        message={`All ${deleting?.memberCount || 0} memberships and the entire chat history will be permanently deleted. Archiving keeps the chat but closes the community.`}
        confirmLabel="Delete community"
        confirmText="DELETE"
      />
    </>
  );
}

function Announcements() {
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'list', '', ''], queryFn: () => roadmapApi.list() });
  const [form, setForm] = useState({ title: '', body: '', audience: 'students', track: '', sendEmail: false });
  const [confirm, setConfirm] = useState(false);
  const send = useMutation({
    mutationFn: () => adminApi.announce({ ...form, track: form.audience === 'track' ? form.track : undefined }),
    onSuccess: (res) => {
      toast.success(res.message);
      setForm({ title: '', body: '', audience: 'students', track: '', sendEmail: false });
      setConfirm(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <div className="card stack" style={{ maxWidth: 760 }}>
      <h2 className="row" style={{ fontSize: '1.05rem', margin: 0, '--gap': '8px' }}><Megaphone size={18} aria-hidden="true" /> Send an announcement</h2>
      <TextField label="Title" required maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <TextAreaField label="Message" required rows={5} maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      <div className="form-grid">
        <SelectField label="Audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} options={[{ value: 'all', label: 'Everyone' }, { value: 'students', label: 'All students' }, { value: 'mentors', label: 'All mentors' }, { value: 'track', label: 'Students in one track' }]} />
        {form.audience === 'track' && <SelectField label="Career track" placeholder="Choose" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} options={(roadmaps?.data || []).map((r) => ({ value: r.slug, label: r.title }))} />}
      </div>
      <Checkbox label="Also email users who opted in to announcements (each email includes an unsubscribe link)" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
      <div>
        <Button variant="primary" icon={Send} disabled={form.title.trim().length < 3 || form.body.trim().length < 5 || (form.audience === 'track' && !form.track)} onClick={() => setConfirm(true)}>Review & send</Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => send.mutate()}
        loading={send.isPending}
        title="Send this announcement?"
        message={`“${form.title}” will be delivered as an in-app notification${form.sendEmail ? ' and emailed to opted-in users' : ''}. It cannot be unsent.`}
        confirmLabel="Send now"
      />
    </div>
  );
}

export function AdminContent() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'opportunities';
  return (
    <>
      <PageTitle title="Content" subtitle="Opportunities, roadmaps, communities and announcements." />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'opportunities', label: 'Opportunities', icon: Briefcase },
          { value: 'roadmaps', label: 'Roadmaps', icon: Compass },
          { value: 'communities', label: 'Communities', icon: Hash },
          { value: 'announce', label: 'Announcements', icon: Megaphone },
        ]}
      />
      {tab === 'opportunities' && <OpportunitiesManager embedded />}
      {tab === 'roadmaps' && <RoadmapsAdmin />}
      {tab === 'communities' && <CommunitiesAdmin />}
      {tab === 'announce' && <Announcements />}
    </>
  );
}
