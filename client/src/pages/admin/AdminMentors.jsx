import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Eye, MailPlus, Pencil, Search, ShieldPlus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { adminApi } from '../../services/api';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { useDebounce } from '../../hooks';
import { fmtDate, timeAgo, titleCase } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Alert, Avatar, Badge, Button, ChipsField, ConfirmDialog, Drawer, EmptyState, ErrorState, Modal, PageLoader, Pagination, ProgressBar, Spinner, TextAreaField, TextField } from '../../components/ui';
import { EditUserModal, InviteResult } from '../../components/admin/UserDialogs';

function AddMentorModal({ onClose, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', headline: '', bio: '', linkedin: '', mentorProfile: { designation: '', company: '', expertise: [], experienceYears: '', maxMentees: '25', availability: '' } });
  const [errors, setErrors] = useState({});
  const set = (path, v) =>
    setForm((f) => {
      const next = structuredClone(f);
      const keys = path.split('.');
      let cur = next;
      keys.slice(0, -1).forEach((k) => (cur = cur[k]));
      cur[keys.at(-1)] = v;
      return next;
    });
  const bind = (path) => ({ value: path.split('.').reduce((o, k) => o[k], form), onChange: (e) => set(path, e.target.value), error: errors[path] });
  const save = useMutation({
    mutationFn: () => adminApi.createMentor({ ...form, mentorProfile: { ...form.mentorProfile, experienceYears: Number(form.mentorProfile.experienceYears) || 0, maxMentees: Number(form.mentorProfile.maxMentees) || 25 } }),
    onSuccess: (res) => onDone({ ...res.data, message: res.message }),
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Add a mentor"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={MailPlus} loading={save.isPending} onClick={() => save.mutate()}>Create & send invite</Button>
        </>
      }
    >
      <div className="stack">
        <p className="small muted mb-0">The mentor receives a secure link to set their own password — you never handle their credentials.</p>
        <div className="form-grid">
          <TextField label="Full name" required maxLength={80} {...bind('name')} data-autofocus />
          <TextField label="Email" type="email" required maxLength={160} {...bind('email')} />
          <TextField label="Phone" type="tel" maxLength={20} {...bind('phone')} />
          <TextField label="LinkedIn URL" type="url" maxLength={300} {...bind('linkedin')} />
          <TextField label="Designation" required maxLength={100} {...bind('mentorProfile.designation')} />
          <TextField label="Company" required maxLength={120} {...bind('mentorProfile.company')} />
          <TextField label="Years of experience" type="number" min={0} max={60} required {...bind('mentorProfile.experienceYears')} />
          <TextField label="Max mentees" type="number" min={1} max={200} {...bind('mentorProfile.maxMentees')} />
        </div>
        <ChipsField label="Expertise" value={form.mentorProfile.expertise} onChange={(v) => set('mentorProfile.expertise', v)} error={errors['mentorProfile.expertise']} max={10} />
        <TextField label="Availability" maxLength={200} {...bind('mentorProfile.availability')} />
        <TextAreaField label="Bio" rows={3} maxLength={1000} {...bind('bio')} />
      </div>
    </Modal>
  );
}

function AddAdminModal({ onClose, onDone }) {
  const [form, setForm] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState({});
  const save = useMutation({
    mutationFn: () => adminApi.createAdmin(form),
    onSuccess: (res) => onDone({ ...res.data, message: res.message }),
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });
  return (
    <Modal open onClose={onClose} title="Invite an administrator" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Send invite</Button></>}>
      <div className="stack">
        <Alert type="warning">Admins can view and export all student data. Invite only trusted staff.</Alert>
        <TextField label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} data-autofocus />
        <TextField label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
      </div>
    </Modal>
  );
}


/** Mentor record — the counterpart of the student View drawer. */
function MentorDrawer({ id, onClose }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-user', id], queryFn: () => adminApi.user(id) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-user', id] });
    qc.invalidateQueries({ queryKey: ['admin-mentors'] });
  };
  const status = useMutation({ mutationFn: (s) => adminApi.setStatus(id, s), onSuccess: (r) => (toast.success(r.message), refresh(), setConfirm(null)), onError: (e) => toast.error(getErrorMessage(e)) });
  const del = useMutation({ mutationFn: () => adminApi.deleteUser(id), onSuccess: (r) => (toast.success(r.message), qc.invalidateQueries({ queryKey: ['admin-mentors'] }), onClose()), onError: (e) => toast.error(getErrorMessage(e)) });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { user: u, mentees = [] } = data.data;
  const mp = u.mentorProfile || {};
  const rows = [
    ['Email', u.email],
    ['Phone', u.phone || '—'],
    ['Designation', mp.designation || '—'],
    ['Company', mp.company || '—'],
    ['Experience', `${mp.experienceYears ?? 0} years`],
    ['Capacity', `${mentees.filter((m) => m.status === 'active').length} of ${mp.maxMentees || 25} mentees`],
    ['Availability', mp.availability || '—'],
    ['LinkedIn', u.links?.linkedin || '—'],
    ['Joined', fmtDate(u.createdAt)],
    ['Last active', timeAgo(u.lastActiveAt)],
  ];
  return (
    <div className="stack" style={{ '--gap': '18px' }}>
      <div className="row">
        <Avatar name={u.name} size={50} />
        <div className="flex-1">
          <h3 style={{ margin: 0 }}>{u.name}</h3>
          <Badge tone={u.status === 'active' ? 'success' : u.status === 'pending' ? 'warning' : 'danger'}>{titleCase(u.status)}</Badge>
        </div>
        <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
      </div>
      {u.bio && <p className="small muted mb-0">{u.bio}</p>}
      <table className="table" style={{ fontSize: '0.86rem' }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><th scope="row" style={{ position: 'static', width: 130, textTransform: 'none', letterSpacing: 0 }}>{k}</th><td style={{ wordBreak: 'break-word' }}>{v}</td></tr>
          ))}
        </tbody>
      </table>
      <section>
        <h4>Expertise</h4>
        <div className="chips">{(mp.expertise || []).map((e) => <span key={e} className="badge badge-primary">{e}</span>)}{!(mp.expertise || []).length && <span className="small muted">None added</span>}</div>
      </section>
      <section>
        <h4>Mentees ({mentees.length})</h4>
        {mentees.length === 0 ? <p className="small muted">No mentees yet.</p> : (
          <ul className="list-plain">
            {mentees.map((m) => (
              <li key={m._id} className="list-row">
                <Avatar name={m.student?.name} size={30} />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="row-between" style={{ flexWrap: 'nowrap' }}>
                    <span className="small bold truncate">{m.student?.name}</span>
                    <Badge tone={m.status === 'active' ? 'success' : 'warning'}>{m.status}</Badge>
                  </div>
                  <div className="xs muted truncate">{m.student?.education?.college}</div>
                  <ProgressBar value={m.student?.readinessScore || 0} small label="Readiness" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        {u.status === 'suspended' ? <Button onClick={() => status.mutate('active')} loading={status.isPending}>Reactivate</Button> : u.status === 'active' ? <Button onClick={() => setConfirm('suspend')}>Suspend</Button> : null}
        <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirm('delete')}>Delete permanently</Button>
      </section>
      {editing && <EditUserModal user={u} onClose={() => setEditing(false)} onSaved={refresh} />}
      <ConfirmDialog open={confirm === 'suspend'} onClose={() => setConfirm(null)} onConfirm={() => status.mutate('suspended')} loading={status.isPending} danger title={`Suspend ${u.name}?`} message="They will be signed out and cannot sign in until reactivated. Existing mentees keep their records." confirmLabel="Suspend" />
      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} onConfirm={() => del.mutate()} loading={del.isPending} danger title={`Permanently delete ${u.name}?`} message="Their account, notes, sessions and opportunities are erased and mentees lose this mentor. This cannot be undone." confirmLabel="Delete forever" confirmText="DELETE" />
    </div>
  );
}

export function AdminMentors() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [invite, setInvite] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const viewId = params.get('view');
  const closeView = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('view'); return n; });
  const debounced = useDebounce(q, 300);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-mentors', status, debounced, page], queryFn: () => adminApi.mentors({ status, q: debounced, page }), placeholderData: (p) => p });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-mentors'] });
  const approve = useMutation({ mutationFn: (id) => adminApi.approveMentor(id), onSuccess: (r) => (toast.success(r.message), refresh()), onError: (e) => toast.error(getErrorMessage(e)) });
  const reject = useMutation({ mutationFn: (id) => adminApi.rejectMentor(id), onSuccess: (r) => (toast.success(r.message), refresh(), setRejecting(null)), onError: (e) => toast.error(getErrorMessage(e)) });
  const resend = useMutation({ mutationFn: (id) => adminApi.resendInvite(id), onSuccess: (r) => setInvite({ inviteLink: r.data.inviteLink, message: r.message }), onError: (e) => toast.error(getErrorMessage(e)) });
  const toggle = useMutation({ mutationFn: ({ id, s }) => adminApi.setStatus(id, s), onSuccess: (r) => (toast.success(r.message), refresh()), onError: (e) => toast.error(getErrorMessage(e)) });

  return (
    <>
      <PageTitle
        title="Mentors"
        subtitle="Review applications, add mentors directly and monitor their mentee load."
        actions={
          <>
            <Button icon={ShieldPlus} onClick={() => setModal('admin')}>Invite admin</Button>
            <Button variant="primary" icon={UserPlus} onClick={() => setModal('mentor')}>Add mentor</Button>
          </>
        }
      />
      <div className="row mb-2">
        <div className="segmented" role="group" aria-label="Filter by status">
          {[['', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['suspended', 'Suspended']].map(([v, l]) => (
            <button key={v || 'all'} type="button" aria-pressed={status === v} onClick={() => (setParams(v ? { status: v } : {}), setPage(1))}>{l}</button>
          ))}
        </div>
        <div style={{ width: 'min(100%, 320px)' }}>
          <TextField label={<span className="sr-only">Search mentors</span>} icon={Search} placeholder="Search name, company, expertise" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : data.data.items.length === 0 ? (
        <div className="card"><EmptyState icon={Users} title="No mentors here">Add a mentor or share the “Become a mentor” page.</EmptyState></div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Mentor</th>
                  <th scope="col">Role</th>
                  <th scope="col">Expertise</th>
                  <th scope="col">Mentees</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.data.items.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Avatar name={m.name} size={32} />
                        <div>
                          <div className="bold small">{m.name}</div>
                          <div className="xs muted">{m.email}{m.phone ? ` · ${m.phone}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="xs">
                      {m.mentorProfile?.designation}
                      <div className="muted">{m.mentorProfile?.company} · {m.mentorProfile?.experienceYears} yrs</div>
                    </td>
                    <td className="xs" style={{ maxWidth: 220 }}>{(m.mentorProfile?.expertise || []).join(', ')}</td>
                    <td className="small">{m.mentees}/{m.mentorProfile?.maxMentees || 25}</td>
                    <td>
                      <Badge tone={m.status === 'active' ? 'success' : m.status === 'pending' ? 'warning' : 'danger'}>{titleCase(m.status)}</Badge>
                      <div className="xs subtle">{m.status === 'pending' ? `Applied ${fmtDate(m.createdAt)}` : `Active ${timeAgo(m.lastActiveAt)}`}</div>
                    </td>
                    <td>
                      <div className="row" style={{ '--gap': '6px', flexWrap: 'nowrap' }}>
                        <Button size="sm" icon={Eye} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set('view', m._id); return n; })}>View</Button>
                        {m.status === 'pending' && !m.mentorProfile?.approvedAt && (
                          <>
                            <Button size="sm" variant="primary" icon={Check} loading={approve.isPending && approve.variables === m._id} onClick={() => approve.mutate(m._id)}>Approve</Button>
                            <Button size="sm" icon={X} onClick={() => setRejecting(m)}>Reject</Button>
                          </>
                        )}
                        {m.status === 'pending' && m.mentorProfile?.approvedAt && (
                          <Button size="sm" icon={MailPlus} loading={resend.isPending && resend.variables === m._id} onClick={() => resend.mutate(m._id)}>Resend invite</Button>
                        )}
                        {m.status === 'active' && <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: m._id, s: 'suspended' })}>Suspend</Button>}
                        {m.status === 'suspended' && <Button size="sm" onClick={() => toggle.mutate({ id: m._id, s: 'active' })}>Reactivate</Button>}
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
      {modal === 'mentor' && <AddMentorModal onClose={() => setModal(null)} onDone={(r) => (setModal(null), setInvite(r), refresh())} />}
      {modal === 'admin' && <AddAdminModal onClose={() => setModal(null)} onDone={(r) => (setModal(null), setInvite(r))} />}
      <Drawer open={Boolean(viewId)} onClose={closeView} title="Mentor record">
        {viewId && <MentorDrawer id={viewId} onClose={closeView} />}
      </Drawer>
      {invite && <InviteResult result={invite} onClose={() => setInvite(null)} />}
      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        onConfirm={() => reject.mutate(rejecting._id)}
        loading={reject.isPending}
        danger
        title={`Reject ${rejecting?.name}'s application?`}
        message="They will be notified by email and their application data deleted."
        confirmLabel="Reject application"
      />
    </>
  );
}
