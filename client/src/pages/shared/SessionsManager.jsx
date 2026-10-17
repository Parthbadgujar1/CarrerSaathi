import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ban, CalendarDays, Pencil, Plus } from 'lucide-react';
import { meetingApi, roadmapApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { toLocalInput } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Button, CardSkeleton, ConfirmDialog, EmptyState, ErrorState, Modal, SelectField, TextAreaField, TextField } from '../../components/ui';
import { MeetingCard } from '../../components/meetings/MeetingCard';

const TYPES = ['seminar', 'workshop', 'guidance', 'mentoring', 'webinar', 'mock-interview'];

function MeetingForm({ initial, onClose }) {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const isAdmin = user.role === 'admin';
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'list', '', ''], queryFn: () => roadmapApi.list() });
  const defaultStart = new Date(Date.now() + 2 * 86_400_000);
  defaultStart.setHours(18, 0, 0, 0);
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    type: initial?.type || 'seminar',
    startAt: toLocalInput(initial?.startAt || defaultStart),
    durationMinutes: String(initial?.durationMinutes || 60),
    audienceType: initial?.audience?.type || (isAdmin ? 'students' : 'mentees'),
    tracks: initial?.audience?.tracks || [],
    mode: initial?.mode || 'in-portal',
    externalUrl: initial?.externalUrl || '',
    capacity: String(initial?.capacity || 500),
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        description: form.description,
        type: form.type,
        startAt: new Date(form.startAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        audience: { type: form.audienceType, tracks: form.audienceType === 'tracks' ? form.tracks : [], users: [] },
        mode: form.mode,
        externalUrl: form.mode === 'external' ? form.externalUrl : '',
        capacity: Number(form.capacity),
      };
      return initial ? meetingApi.update(initial._id, body) : meetingApi.create(body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['meetings'] });
      onClose();
    },
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });

  const audienceOptions = isAdmin
    ? [{ value: 'all', label: 'Everyone (students + mentors)' }, { value: 'students', label: 'All students' }, { value: 'mentors', label: 'All mentors' }, { value: 'tracks', label: 'Students in selected career tracks' }]
    : [{ value: 'mentees', label: 'My mentees' }, { value: 'students', label: 'All students' }, { value: 'tracks', label: 'Students in selected career tracks' }];

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={initial ? 'Edit session' : 'Schedule a session'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            {initial ? 'Save changes' : 'Schedule & notify'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <TextField label="Title" required maxLength={140} value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} data-autofocus />
        <TextAreaField label="Description" rows={3} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} />
        <div className="form-grid">
          <SelectField label="Type" value={form.type} onChange={(e) => set('type', e.target.value)} options={TYPES.map((t) => ({ value: t, label: t.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase()) }))} />
          <TextField label="Starts at (your local time)" type="datetime-local" required value={form.startAt} onChange={(e) => set('startAt', e.target.value)} error={errors.startAt} />
          <SelectField label="Duration" value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} options={['30', '45', '60', '90', '120', '180'].map((m) => ({ value: m, label: `${m} minutes` }))} />
          <TextField label="Capacity" type="number" min={1} max={10000} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
        </div>
        <SelectField label="Audience" value={form.audienceType} onChange={(e) => set('audienceType', e.target.value)} options={audienceOptions} hint="Everyone in the audience gets an in-app notification." />
        {form.audienceType === 'tracks' && (
          <fieldset className="card" style={{ padding: 12 }}>
            <legend className="label">Career tracks</legend>
            {errors['audience.tracks'] && <p className="field-error">{errors['audience.tracks']}</p>}
            <div className="grid-2" style={{ gap: 6 }}>
              {(roadmaps?.data || []).map((r) => (
                <label key={r.slug} className="checkbox small">
                  <input type="checkbox" checked={form.tracks.includes(r.slug)} onChange={(e) => set('tracks', e.target.checked ? [...form.tracks, r.slug] : form.tracks.filter((t) => t !== r.slug))} />
                  {r.title}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="form-grid">
          <SelectField label="Where" value={form.mode} onChange={(e) => set('mode', e.target.value)} options={[{ value: 'in-portal', label: 'In-portal video room (Jitsi)' }, { value: 'external', label: 'External link (Meet / Zoom / Teams)' }]} />
          {form.mode === 'external' && <TextField label="Meeting link" type="url" required placeholder="https://…" maxLength={500} value={form.externalUrl} onChange={(e) => set('externalUrl', e.target.value)} error={errors.externalUrl} />}
        </div>
      </div>
    </Modal>
  );
}

export function SessionsManager() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [when, setWhen] = useState('upcoming');
  const [scope, setScope] = useState(user.role === 'admin' ? 'all' : 'hosted');
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meetings', 'manage', when, scope],
    queryFn: () => meetingApi.list({ when, hosted: scope === 'hosted' ? 'true' : undefined, limit: 50 }),
  });
  const cancel = useMutation({
    mutationFn: (id) => meetingApi.cancel(id),
    onSuccess: (res) => {
      toast.success(res.message);
      setCancelling(null);
      qc.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <>
      <PageTitle
        title="Sessions"
        subtitle="Schedule seminars, guidance sessions and mock interviews. Attendees join from their dashboard."
        actions={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Schedule session</Button>}
      />
      <div className="row mb-2">
        <div className="segmented" role="group" aria-label="When">
          <button type="button" aria-pressed={when === 'upcoming'} onClick={() => setWhen('upcoming')}>Upcoming</button>
          <button type="button" aria-pressed={when === 'past'} onClick={() => setWhen('past')}>Past</button>
        </div>
        {user.role === 'admin' && (
          <div className="segmented" role="group" aria-label="Whose sessions">
            <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All sessions</button>
            <button type="button" aria-pressed={scope === 'hosted'} onClick={() => setScope('hosted')}>Hosted by me</button>
          </div>
        )}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid-2"><CardSkeleton /><CardSkeleton /></div>
      ) : data.data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={CalendarDays} title="No sessions here" action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Schedule one</Button>}>
            Sessions you schedule are announced to the audience you choose.
          </EmptyState>
        </div>
      ) : (
        <div className="grid-2">
          {data.data.items.map((m) => {
            const canEdit = user.role === 'admin' || m.host?._id === user._id;
            return (
              <MeetingCard
                key={m._id}
                meeting={m}
                actions={
                  canEdit && m.status === 'scheduled' && when === 'upcoming' ? (
                    <>
                      <Button size="sm" icon={Pencil} onClick={() => setEditing(m)}>Edit</Button>
                      <Button size="sm" variant="danger-ghost" icon={Ban} onClick={() => setCancelling(m)}>Cancel</Button>
                    </>
                  ) : (
                    <span />
                  )
                }
              />
            );
          })}
        </div>
      )}
      {editing && <MeetingForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel.mutate(cancelling._id)}
        loading={cancel.isPending}
        danger
        title="Cancel this session?"
        message={`“${cancelling?.title}” will be cancelled and ${cancelling?.attendeeCount || 0} registered attendee(s) notified. This cannot be undone.`}
        confirmLabel="Cancel session"
      />
    </>
  );
}
