import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { opportunityApi, roadmapApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { fmtDate, titleCase } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Badge, Button, Checkbox, ConfirmDialog, EmptyState, ErrorState, Modal, Pagination, SelectField, Spinner, TextAreaField, TextField } from '../../components/ui';
import { SOURCE_LABEL } from '../../components/opportunities/OpportunityCard';

const TYPES = ['job', 'internship', 'hackathon', 'competition', 'scholarship', 'workshop', 'event'];

function OpportunityForm({ initial, onClose }) {
  const qc = useQueryClient();
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'list', '', ''], queryFn: () => roadmapApi.list() });
  const [form, setForm] = useState({
    title: initial?.title || '',
    organization: initial?.organization || '',
    type: initial?.type || 'internship',
    source: initial?.source || 'internsaathi',
    url: initial?.url || '',
    description: initial?.description || '',
    location: initial?.location || '',
    mode: initial?.mode || 'remote',
    compensation: initial?.compensation || '',
    eligibility: initial?.eligibility || '',
    tracks: initial?.tracks || [],
    deadline: initial?.deadline ? initial.deadline.slice(0, 10) : '',
    status: initial?.status || 'active',
    notifyStudents: !initial,
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, deadline: form.deadline ? new Date(`${form.deadline}T23:59:00`).toISOString() : null };
      return initial ? opportunityApi.update(initial._id, body) : opportunityApi.create(body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      onClose();
    },
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });
  const bind = (k) => ({ value: form[k], onChange: (e) => set(k, e.target.value), error: errors[k] });
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={initial ? 'Edit opportunity' : 'Post an opportunity'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>{initial ? 'Save changes' : 'Publish'}</Button>
        </>
      }
    >
      <div className="stack">
        <div className="form-grid">
          <TextField label="Title" required maxLength={140} {...bind('title')} data-autofocus />
          <TextField label="Organisation" required maxLength={120} {...bind('organization')} />
          <SelectField label="Type" options={TYPES.map((t) => ({ value: t, label: titleCase(t) }))} {...bind('type')} />
          <SelectField label="Source / platform" options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))} {...bind('source')} />
          <TextField label="Application link" type="url" placeholder="https://…" maxLength={500} {...bind('url')} />
          <TextField label="Deadline" type="date" min={new Date().toISOString().slice(0, 10)} {...bind('deadline')} />
          <SelectField label="Mode" options={['remote', 'onsite', 'hybrid'].map((m) => ({ value: m, label: titleCase(m) }))} {...bind('mode')} />
          <TextField label="Location" maxLength={120} {...bind('location')} />
          <TextField label="Stipend / salary / prize" maxLength={80} {...bind('compensation')} />
          <SelectField label="Status" options={[{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft (hidden)' }, { value: 'closed', label: 'Closed' }]} {...bind('status')} />
        </div>
        <TextAreaField label="Description" rows={4} maxLength={3000} {...bind('description')} />
        <TextField label="Eligibility" maxLength={400} placeholder="e.g. 2026/2027 graduates, any branch" {...bind('eligibility')} />
        <fieldset className="card" style={{ padding: 12 }}>
          <legend className="label">Relevant career tracks <span className="subtle">(leave empty for everyone)</span></legend>
          <div className="grid-2" style={{ gap: 6 }}>
            {(roadmaps?.data || []).map((r) => (
              <label key={r.slug} className="checkbox small">
                <input type="checkbox" checked={form.tracks.includes(r.slug)} onChange={(e) => set('tracks', e.target.checked ? [...form.tracks, r.slug] : form.tracks.filter((t) => t !== r.slug))} />
                {r.title}
              </label>
            ))}
          </div>
        </fieldset>
        {!initial && <Checkbox label="Notify matching students in-app" checked={form.notifyStudents} onChange={(e) => set('notifyStudents', e.target.checked)} />}
        <p className="xs muted mb-0">Only post genuine opportunities. Never list roles that charge students a fee.</p>
      </div>
    </Modal>
  );
}

export function OpportunitiesManager({ embedded }) {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['opportunities', 'manage', page], queryFn: () => opportunityApi.manage({ page }) });
  const del = useMutation({
    mutationFn: (id) => opportunityApi.remove(id),
    onSuccess: (res) => {
      toast.success(res.message);
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['opportunities'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const add = <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Post opportunity</Button>;
  return (
    <>
      {embedded ? (
        <div className="row-between mb-2">
          <p className="muted small mb-0">All opportunities posted by admins and mentors.</p>
          {add}
        </div>
      ) : (
        <PageTitle title="Opportunities" subtitle={user.role === 'mentor' ? 'Share internships, jobs and competitions with students. You see the ones you posted.' : 'Manage opportunities.'} actions={add} />
      )}
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : data.data.items.length === 0 ? (
        <div className="card"><EmptyState icon={Briefcase} title="Nothing posted yet" action={add}>Opportunities you post appear in students' feeds, matched to their career tracks.</EmptyState></div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Opportunity</th>
                  <th scope="col">Type</th>
                  <th scope="col">Deadline</th>
                  <th scope="col">Status</th>
                  <th scope="col">Engagement</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.data.items.map((o) => (
                  <tr key={o._id}>
                    <td>
                      <div className="bold small">{o.title}</div>
                      <div className="xs muted">{o.organization} · {SOURCE_LABEL[o.source]}{user.role === 'admin' && o.postedBy ? ` · by ${o.postedBy.name}` : ''}</div>
                    </td>
                    <td><Badge>{titleCase(o.type)}</Badge></td>
                    <td className="small nowrap">{fmtDate(o.deadline)}</td>
                    <td><Badge tone={o.status === 'active' ? 'success' : o.status === 'draft' ? 'warning' : undefined}>{titleCase(o.status)}</Badge></td>
                    <td className="xs muted nowrap">{o.views} views · {o.stats.saved || 0} saved · {(o.stats.applied || 0) + (o.stats.interview || 0) + (o.stats.offer || 0)} applied</td>
                    <td>
                      <div className="row" style={{ '--gap': '4px', flexWrap: 'nowrap' }}>
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(o)} aria-label={`Edit ${o.title}`}>Edit</Button>
                        <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(o)} aria-label={`Delete ${o.title}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.data.pagination} onPage={setPage} />
        </>
      )}
      {editing && <OpportunityForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => del.mutate(deleting._id)}
        loading={del.isPending}
        danger
        title="Delete this opportunity?"
        message={`“${deleting?.title}” will be removed from all feeds and students' trackers. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </>
  );
}
