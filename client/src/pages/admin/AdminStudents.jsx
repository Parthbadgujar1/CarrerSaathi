import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Ban, CheckCircle2, Download, FileSpreadsheet, Filter, GraduationCap, Pencil, RotateCcw, Search, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { AddStudentModal, EditUserModal, InviteResult } from '../../components/admin/UserDialogs';
import { adminApi, downloadBlob, roadmapApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { useDebounce } from '../../hooks';
import { fmtDate, timeAgo, titleCase } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Alert, Avatar, Badge, Button, Checkbox, ConfirmDialog, Drawer, EmptyState, ErrorState, Modal, PageLoader, Pagination, ProgressBar, SelectField, Spinner, TextField } from '../../components/ui';
import { DEGREES, GRAD_YEARS } from '../auth/Register';

const EMPTY_FILTERS = { q: '', college: '', degree: '', track: '', graduationYear: '', status: '', verified: '', from: '', to: '', sort: 'newest' };

function ExportModal({ open, onClose, filters, selectedIds, total }) {
  const { data } = useQuery({ queryKey: ['export-fields'], queryFn: adminApi.exportFields, enabled: open, staleTime: Infinity });
  const fields = data?.data || [];
  const [chosen, setChosen] = useState(null);
  const [scope, setScope] = useState(selectedIds.length ? 'selected' : 'filtered');
  const [loading, setLoading] = useState(false);
  const active = chosen ?? fields.map((f) => f.key);
  const run = async () => {
    setLoading(true);
    try {
      const res = await adminApi.exportStudents({ filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), fields: active, ids: scope === 'selected' ? selectedIds : [] });
      downloadBlob(res, 'careersaathi-students.xlsx');
      toast.success('Excel file downloaded.');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Export student records"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Download} loading={loading} disabled={!active.length} onClick={run}>Download .xlsx</Button>
        </>
      }
    >
      <div className="stack">
        <div className="segmented" role="group" aria-label="Rows to export">
          <button type="button" aria-pressed={scope === 'filtered'} onClick={() => setScope('filtered')}>All matching filters ({total})</button>
          <button type="button" aria-pressed={scope === 'selected'} disabled={!selectedIds.length} onClick={() => setScope('selected')}>Selected ({selectedIds.length})</button>
        </div>
        <div className="row-between">
          <span className="label">Columns</span>
          <span className="row" style={{ '--gap': '10px' }}>
            <button type="button" className="linklike small" onClick={() => setChosen(fields.map((f) => f.key))}>Select all</button>
            <button type="button" className="linklike small" onClick={() => setChosen([])}>Clear</button>
          </span>
        </div>
        <div className="grid-3" style={{ gap: 6 }}>
          {fields.map((f) => (
            <Checkbox key={f.key} label={f.label} checked={active.includes(f.key)} onChange={(e) => setChosen(e.target.checked ? [...active, f.key] : active.filter((k) => k !== f.key))} />
          ))}
        </div>
        <Alert type="info">Exports contain personal data. Store the file securely and share it only with authorised staff. Every export is recorded in the audit log.</Alert>
      </div>
    </Modal>
  );
}

function StudentDrawer({ id, onClose }) {
  const qc = useQueryClient();
  const [assigning, setAssigning] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-user', id], queryFn: () => adminApi.user(id) });
  const mentors = useQuery({ queryKey: ['admin-mentors', 'active-all'], queryFn: () => adminApi.mentors({ status: 'active', limit: 100 }) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-user', id] });
    qc.invalidateQueries({ queryKey: ['admin-students'] });
  };
  const status = useMutation({ mutationFn: (s) => adminApi.setStatus(id, s), onSuccess: (r) => (toast.success(r.message), refresh(), setConfirm(null)), onError: (e) => toast.error(getErrorMessage(e)) });
  const assign = useMutation({ mutationFn: () => adminApi.assignMentor(id, assigning), onSuccess: (r) => (toast.success(r.message), refresh(), setAssigning('')), onError: (e) => toast.error(getErrorMessage(e)) });
  const del = useMutation({
    mutationFn: () => adminApi.deleteUser(id),
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ['admin-students'] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { user: u, enrollments, readiness, applications, mentorships, wellnessCheckins } = data.data;
  const rows = [
    ['Email', u.email, u.emailVerified ? <Badge key="v" tone="success">Verified</Badge> : <Badge key="v" tone="warning">Unverified</Badge>],
    ['Phone', u.phone || '—'],
    ['Degree', [u.education?.degree, u.education?.branch].filter(Boolean).join(', ') || '—'],
    ['College', u.education?.college || '—'],
    ['University', u.education?.university || '—'],
    ['Year / graduation', `${u.education?.currentYear ? `Year ${u.education.currentYear}` : '—'} · ${u.education?.graduationYear || '—'}`],
    ['CGPA', u.education?.cgpa ?? '—'],
    ['Address', [u.address?.line1, u.address?.city, u.address?.state, u.address?.pincode].filter(Boolean).join(', ') || '—'],
    ['Signup source', u.acquisition?.utmSource || 'direct'],
    ['Registered', fmtDate(u.createdAt)],
    ['Last active', timeAgo(u.lastActiveAt)],
    ['Marketing emails', u.consents?.marketingEmails ? 'Opted in' : 'Not opted in'],
  ];
  return (
    <div className="stack" style={{ '--gap': '18px' }}>
      <div className="row">
        <Avatar name={u.name} size={50} />
        <div className="flex-1">
          <h3 style={{ margin: 0 }}>{u.name}</h3>
          <Badge tone={u.status === 'active' ? 'success' : 'danger'}>{titleCase(u.status)}</Badge>
        </div>
        <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
      </div>
      <table className="table" style={{ fontSize: '0.86rem' }}>
        <tbody>
          {rows.map(([k, v, extra]) => (
            <tr key={k}>
              <th scope="row" style={{ position: 'static', width: 140, textTransform: 'none', letterSpacing: 0 }}>{k}</th>
              <td>{v} {extra}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section>
        <h4>Readiness: {readiness?.score}/100</h4>
        {readiness?.breakdown.map((b) => (
          <div key={b.key} className="mb-1">
            <div className="row-between xs"><span className="muted">{b.label}</span><span>{b.score}/{b.max}</span></div>
            <ProgressBar value={(b.score / b.max) * 100} small label={b.label} />
          </div>
        ))}
      </section>
      <section>
        <h4>Roadmaps</h4>
        {enrollments.length ? enrollments.map((e) => <div key={e._id} className="row-between small"><span>{e.roadmap?.title}</span><span className="bold">{e.progress}%</span></div>) : <p className="small muted">None</p>}
      </section>
      <section>
        <h4>Applications ({applications.length}) · Wellness check-ins: {wellnessCheckins}</h4>
        {applications.slice(0, 6).map((a) => <div key={a._id} className="xs">{a.opportunity?.title} — {titleCase(a.status)}</div>)}
      </section>
      <section className="stack" style={{ '--gap': '8px' }}>
        <h4 style={{ margin: 0 }}>Mentors</h4>
        {mentorships.length ? mentorships.map((m) => <div key={m._id} className="small">{m.mentor?.name} <Badge>{m.status}</Badge></div>) : <p className="small muted mb-0">No mentor yet.</p>}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <SelectField label="Assign a mentor" placeholder="Choose mentor" value={assigning} onChange={(e) => setAssigning(e.target.value)} options={(mentors.data?.data?.items || []).map((m) => ({ value: m._id, label: `${m.name} (${m.mentees}/${m.mentorProfile?.maxMentees || 25})` }))} />
          <Button icon={UserCheck} disabled={!assigning} loading={assign.isPending} onClick={() => assign.mutate()}>Assign</Button>
        </div>
      </section>
      <section className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        {u.status === 'suspended' ? (
          <Button icon={CheckCircle2} onClick={() => status.mutate('active')} loading={status.isPending}>Reactivate</Button>
        ) : (
          <Button icon={Ban} onClick={() => setConfirm('suspend')}>Suspend</Button>
        )}
        <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirm('delete')}>Delete permanently</Button>
      </section>
      {editing && <EditUserModal user={u} onClose={() => setEditing(false)} onSaved={refresh} />}
      <ConfirmDialog
        open={confirm === 'suspend'}
        onClose={() => setConfirm(null)}
        onConfirm={() => status.mutate('suspended')}
        loading={status.isPending}
        title={`Suspend ${u.name}?`}
        message="They will be signed out everywhere and cannot sign in until reactivated."
        confirmLabel="Suspend"
        danger
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => del.mutate()}
        loading={del.isPending}
        title={`Permanently delete ${u.name}?`}
        message="All of this student's data (profile, progress, messages, wellness logs) will be erased. This cannot be undone."
        confirmLabel="Delete forever"
        confirmText="DELETE"
        danger
      />
    </div>
  );
}

export function AdminStudents() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [invite, setInvite] = useState(null);
  const debouncedQ = useDebounce(filters.q, 300);
  const debouncedCollege = useDebounce(filters.college, 300);
  const query = useMemo(() => ({ ...filters, q: debouncedQ, college: debouncedCollege, page, limit: 25 }), [filters, debouncedQ, debouncedCollege, page]);
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'list', '', ''], queryFn: () => roadmapApi.list() });
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['admin-students', query], queryFn: () => adminApi.students(query), placeholderData: (p) => p });
  const items = data?.data?.items || [];
  const allOnPage = items.length > 0 && items.every((s) => selected.has(s._id));
  const setF = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'sort' && k !== 'q').length;
  const titleBySlug = Object.fromEntries((roadmaps?.data || []).map((r) => [r.slug, r.title]));

  return (
    <>
      <PageTitle
        title="Students"
        subtitle="Registrations, contact details and progress. Export any view to Excel."
        actions={<><Button icon={UserPlus} onClick={() => setAdding(true)}>Add student</Button><Button variant="primary" icon={FileSpreadsheet} onClick={() => setExporting(true)}>Export to Excel</Button></>}
      />
      <div className="card mb-2 stack" style={{ '--gap': '12px' }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <TextField className="flex-1" label="Search" icon={Search} placeholder="Name, email, phone or college" value={filters.q} onChange={(e) => setF('q', e.target.value)} maxLength={100} />
          <SelectField label="Sort" value={filters.sort} onChange={(e) => setF('sort', e.target.value)} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name', label: 'Name A–Z' }, { value: 'readiness', label: 'Highest readiness' }, { value: 'active', label: 'Recently active' }]} />
          <Button icon={Filter} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
          {activeFilterCount > 0 && <Button variant="ghost" icon={RotateCcw} onClick={() => (setFilters(EMPTY_FILTERS), setPage(1))}>Reset</Button>}
        </div>
        {showFilters && (
          <div className="form-grid fade-in">
            <TextField label="College" value={filters.college} onChange={(e) => setF('college', e.target.value)} />
            <SelectField label="Degree" placeholder="Any" options={DEGREES} value={filters.degree} onChange={(e) => setF('degree', e.target.value)} />
            <SelectField label="Career track" placeholder="Any" options={(roadmaps?.data || []).map((r) => ({ value: r.slug, label: r.title }))} value={filters.track} onChange={(e) => setF('track', e.target.value)} />
            <SelectField label="Graduation year" placeholder="Any" options={GRAD_YEARS} value={filters.graduationYear} onChange={(e) => setF('graduationYear', e.target.value)} />
            <SelectField label="Status" placeholder="Any" options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'deletion_pending', label: 'Deletion pending' }]} value={filters.status} onChange={(e) => setF('status', e.target.value)} />
            <SelectField label="Email verified" placeholder="Any" options={[{ value: 'true', label: 'Verified' }, { value: 'false', label: 'Not verified' }]} value={filters.verified} onChange={(e) => setF('verified', e.target.value)} />
            <TextField label="Registered from" type="date" value={filters.from} onChange={(e) => setF('from', e.target.value)} />
            <TextField label="Registered to" type="date" value={filters.to} onChange={(e) => setF('to', e.target.value)} />
          </div>
        )}
      </div>
      {selected.size > 0 && (
        <div className="alert alert-info mb-2" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div className="row-between flex-1">
            <span>{selected.size} selected</span>
            <span className="row" style={{ '--gap': '8px' }}>
              <Button size="sm" icon={Download} onClick={() => setExporting(true)}>Export selected</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </span>
          </div>
        </div>
      )}
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="card"><EmptyState icon={GraduationCap} title="No students match">Adjust or reset the filters.</EmptyState></div>
      ) : (
        <div style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity .2s' }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="cell-check">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allOnPage}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          items.forEach((s) => (e.target.checked ? next.add(s._id) : next.delete(s._id)));
                          return next;
                        })
                      }
                    />
                  </th>
                  <th scope="col">Student</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Education</th>
                  <th scope="col">Tracks</th>
                  <th scope="col">Readiness</th>
                  <th scope="col">Registered</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s._id}>
                    <td className="cell-check">
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.name}`}
                        checked={selected.has(s._id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s._id);
                            else next.delete(s._id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Avatar name={s.name} size={30} />
                        <div>
                          <div className="bold small">{s.name}</div>
                          {s.status !== 'active' && <Badge tone="danger">{titleCase(s.status)}</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="xs">
                      {s.email} {!s.emailVerified && <Badge tone="warning">unverified</Badge>}
                      <div className="muted">{s.phone || '—'}</div>
                    </td>
                    <td className="xs">
                      {[s.education?.degree, s.education?.branch].filter(Boolean).join(', ')}
                      <div className="muted">{s.education?.college}{s.address?.city ? ` · ${s.address.city}` : ''}</div>
                    </td>
                    <td className="xs" style={{ maxWidth: 180 }}>{(s.careerTracks || []).map((t) => titleBySlug[t] || t).join(', ') || '—'}</td>
                    <td className="small bold">{s.readinessScore}</td>
                    <td className="xs muted nowrap">{fmtDate(s.createdAt)}</td>
                    <td><Button size="sm" onClick={() => setParams({ student: s._id })}>View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.data.pagination} onPage={setPage} />
        </div>
      )}
      {adding && <AddStudentModal onClose={() => setAdding(false)} onDone={(r) => (setAdding(false), setInvite(r))} />}
      {invite && <InviteResult result={invite} onClose={() => setInvite(null)} />}
      {exporting && <ExportModal open onClose={() => setExporting(false)} filters={filters} selectedIds={[...selected]} total={data?.data?.pagination?.total || 0} />}
      <Drawer open={Boolean(params.get('student'))} onClose={() => setParams({})} title="Student record">
        {params.get('student') && <StudentDrawer id={params.get('student')} onClose={() => setParams({})} />}
      </Drawer>
    </>
  );
}
