import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Circle, ExternalLink, GraduationCap, HeartPulse, MessagesSquare, Search, Trash2 } from 'lucide-react';
import { chatApi, mentorshipApi, roadmapApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { useDebounce } from '../../hooks';
import { fmtDate, timeAgo, titleCase } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Alert, Avatar, Badge, Button, Checkbox, Drawer, EmptyState, ErrorState, IconButton, PageLoader, Pagination, ProgressBar, ProgressRing, SelectField, Spinner, TextAreaField, TextField } from '../../components/ui';

function StudentDetail({ id }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['mentor-student', id], queryFn: () => mentorshipApi.student(id) });
  const [note, setNote] = useState({ type: 'goal', text: '', visibleToStudent: true });
  const add = useMutation({
    mutationFn: () => mentorshipApi.addNote(id, note),
    onSuccess: () => {
      toast.success('Saved');
      setNote({ ...note, text: '' });
      qc.invalidateQueries({ queryKey: ['mentor-student', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const del = useMutation({
    mutationFn: (noteId) => mentorshipApi.deleteNote(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mentor-student', id] }),
  });
  const chat = useMutation({
    mutationFn: () => chatApi.direct(id),
    onSuccess: (res) => navigate(`/mentor/messages?c=${res.data._id}`),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  const s = d.student;
  return (
    <div className="stack" style={{ '--gap': '18px' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Avatar name={s.name} size={52} />
        <div className="flex-1">
          <h3 style={{ margin: 0 }}>{s.name}</h3>
          <div className="small muted">{[s.education?.degree, s.education?.branch].filter(Boolean).join(', ')}</div>
          <div className="xs subtle">{s.education?.college}{s.education?.graduationYear ? ` · Class of ${s.education.graduationYear}` : ''} · active {timeAgo(s.lastActiveAt)}</div>
          {s.headline && <p className="small mt-1 mb-0">{s.headline}</p>}
        </div>
        {d.isMentee ? <Badge tone="success">Your mentee</Badge> : <Badge>Not your mentee</Badge>}
      </div>
      {d.isMentee && (
        <div className="row">
          <Button size="sm" variant="primary" icon={MessagesSquare} loading={chat.isPending} onClick={() => chat.mutate()}>Message</Button>
          {Object.entries(s.links || {}).filter(([, v]) => v).map(([k, v]) => (
            <Button key={k} size="sm" href={v} target="_blank" rel="noopener noreferrer" iconRight={ExternalLink}>{titleCase(k)}</Button>
          ))}
        </div>
      )}

      <section className="card row" style={{ alignItems: 'center' }}>
        <ProgressRing value={d.readiness.score} size={96} stroke={8} label="Readiness" />
        <ul className="list-plain flex-1 stack" style={{ '--gap': '6px' }}>
          {d.readiness.breakdown.map((b) => (
            <li key={b.key}>
              <div className="row-between xs"><span className="muted">{b.label}</span><span className="bold">{b.score}/{b.max}</span></div>
              <ProgressBar value={(b.score / b.max) * 100} small label={b.label} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Roadmaps</h4>
        {d.enrollments.length === 0 ? <p className="small muted">Not following any roadmap yet.</p> : d.enrollments.map((e) => (
          <div key={e._id} className="mb-1">
            <div className="row-between small"><span>{e.roadmap.title}</span><span className="bold">{e.progress}%</span></div>
            <ProgressBar value={e.progress} small label={e.roadmap.title} />
          </div>
        ))}
      </section>

      <section>
        <h4>Career kit ({d.readiness.kit.done}/{d.readiness.kit.total})</h4>
        <ul className="list-plain" style={{ columns: 2, columnGap: 16 }}>
          {d.readiness.kit.items.map((i) => (
            <li key={i.key} className="xs row" style={{ '--gap': '6px', breakInside: 'avoid', marginBottom: 6, alignItems: 'flex-start' }}>
              {i.done ? <CheckCircle2 size={14} color="var(--success)" aria-label="Done" /> : <Circle size={14} color="var(--text-subtle)" aria-label="Not done" />}
              <span>{i.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Applications</h4>
        <div className="chips">
          {['saved', 'applied', 'interview', 'offer', 'rejected'].map((st) => <span key={st} className="badge">{titleCase(st)}: {d.applications[st] || 0}</span>)}
        </div>
      </section>

      {d.isMentee && (
        <section>
          <h4 className="row" style={{ '--gap': '6px' }}><HeartPulse size={15} aria-hidden="true" /> Wellbeing (last 14 days)</h4>
          {d.wellness ? (
            <div className="grid-3" style={{ gap: 8 }}>
              <div className="card" style={{ padding: 12 }}><div className="xs muted">Avg mood</div><div className="bold">{d.wellness.avgMood ?? '—'} / 5</div></div>
              <div className="card" style={{ padding: 12 }}><div className="xs muted">Avg stress</div><div className="bold">{d.wellness.avgStress ?? '—'} / 5</div></div>
              <div className="card" style={{ padding: 12 }}><div className="xs muted">Avg sleep</div><div className="bold">{d.wellness.avgSleep ?? '—'} h</div></div>
            </div>
          ) : (
            <p className="small muted">{d.wellnessShared ? 'No check-ins in the last 14 days.' : 'The student has not chosen to share wellness data.'}</p>
          )}
          {d.wellness?.avgMood && d.wellness.avgMood <= 2.2 && <Alert type="warning" className="mt-1">Mood has been low recently. A gentle, supportive check-in could help.</Alert>}
        </section>
      )}

      {d.isMentee && (
        <section className="stack" style={{ '--gap': '10px' }}>
          <h4 style={{ margin: 0 }}>Goals, notes & feedback</h4>
          <form
            className="stack"
            style={{ '--gap': '10px' }}
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <div className="row">
              <SelectField label="Type" value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })} options={[{ value: 'goal', label: 'Goal' }, { value: 'feedback', label: 'Feedback' }, { value: 'note', label: 'Private note' }]} />
            </div>
            <TextAreaField label="Text" rows={3} maxLength={2000} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
            <Checkbox label="Visible to the student" checked={note.visibleToStudent} onChange={(e) => setNote({ ...note, visibleToStudent: e.target.checked })} />
            <div><Button type="submit" variant="primary" size="sm" loading={add.isPending} disabled={note.text.trim().length < 2}>Add</Button></div>
          </form>
          {d.notes.map((n) => (
            <div key={n._id} className="card" style={{ padding: 12 }}>
              <div className="row-between">
                <div className="row" style={{ '--gap': '6px' }}>
                  <Badge tone={n.type === 'goal' ? 'primary' : n.type === 'feedback' ? 'accent' : undefined}>{titleCase(n.type)}</Badge>
                  {n.type === 'goal' && n.done && <Badge tone="success">Done</Badge>}
                  {!n.visibleToStudent && <Badge>Private</Badge>}
                </div>
                <IconButton icon={Trash2} label="Delete note" onClick={() => del.mutate(n._id)} />
              </div>
              <p className="small mt-1 mb-0 pre-line">{n.text}</p>
              <div className="xs subtle">{fmtDate(n.createdAt)}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function MentorStudents() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('student');
  const [scope, setScope] = useState('mine');
  const [q, setQ] = useState('');
  const [track, setTrack] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q, 300);
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'list', '', ''], queryFn: () => roadmapApi.list() });
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['mentor-students', scope, debounced, track, page],
    queryFn: () => mentorshipApi.students({ scope, q: debounced, track, page }),
    placeholderData: (p) => p,
  });
  const titleBySlug = Object.fromEntries((roadmaps?.data || []).map((r) => [r.slug, r.title]));

  return (
    <>
      <PageTitle title="Students" subtitle="Track your mentees' progress — or browse all students to see where help is needed." />
      <div className="card mb-2">
        <div className="form-grid" style={{ alignItems: 'end' }}>
          <div className="field">
            <span className="label">Show</span>
            <div className="segmented" role="group" aria-label="Which students">
              <button type="button" aria-pressed={scope === 'mine'} onClick={() => (setScope('mine'), setPage(1))}>My mentees</button>
              <button type="button" aria-pressed={scope === 'all'} onClick={() => (setScope('all'), setPage(1))}>All students</button>
            </div>
          </div>
          <TextField label="Search" icon={Search} placeholder="Name, college or degree" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          <SelectField label="Career track" placeholder="All tracks" value={track} onChange={(e) => (setTrack(e.target.value), setPage(1))} options={(roadmaps?.data || []).map((r) => ({ value: r.slug, label: r.title }))} />
        </div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Spinner />
      ) : data.data.items.length === 0 ? (
        <div className="card"><EmptyState icon={GraduationCap} title={scope === 'mine' ? 'No mentees yet' : 'No students found'}>{scope === 'mine' ? 'Accepted mentorship requests and admin assignments appear here.' : 'Try another search.'}</EmptyState></div>
      ) : (
        <div style={{ opacity: isFetching ? 0.6 : 1 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Education</th>
                  <th scope="col">Tracks</th>
                  <th scope="col">Readiness</th>
                  <th scope="col">Last active</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.data.items.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Avatar name={s.name} size={30} />
                        <span className="bold">{s.name}</span>
                        {s.isMyMentee && <Badge tone="success">Mentee</Badge>}
                      </div>
                    </td>
                    <td className="small">
                      {[s.education?.degree, s.education?.branch].filter(Boolean).join(', ')}
                      <div className="xs muted">{s.education?.college}</div>
                    </td>
                    <td className="xs">{(s.careerTracks || []).map((t) => titleBySlug[t] || t).join(', ') || '—'}</td>
                    <td style={{ minWidth: 120 }}>
                      <div className="row xs" style={{ '--gap': '8px', flexWrap: 'nowrap' }}>
                        <span className="flex-1"><ProgressBar value={s.readinessScore} small label={`${s.name} readiness`} /></span>
                        <span className="bold">{s.readinessScore}</span>
                      </div>
                    </td>
                    <td className="xs muted nowrap">{timeAgo(s.lastActiveAt)}</td>
                    <td>
                      <Button size="sm" onClick={() => setParams({ student: s._id })}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.data.pagination} onPage={setPage} />
        </div>
      )}
      <Drawer open={Boolean(selected)} onClose={() => setParams({})} title="Student progress">
        {selected && <StudentDetail id={selected} />}
      </Drawer>
    </>
  );
}
