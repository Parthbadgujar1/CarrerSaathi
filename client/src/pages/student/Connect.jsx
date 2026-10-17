import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Hash, MessagesSquare, Plus, Search, UserPlus, Users } from 'lucide-react';
import { chatApi, communityApi, mentorshipApi } from '../../services/api';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { useDebounce } from '../../hooks';
import { timeAgo } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Avatar, Badge, Button, CardSkeleton, ConfirmDialog, EmptyState, ErrorState, Modal, Pagination, Tabs, TextAreaField, TextField } from '../../components/ui';
import { ChatWorkspace } from '../../components/chat/ChatWorkspace';

function useOpenConversation() {
  const [params, setParams] = useSearchParams();
  return useCallback((id) => setParams(id ? { tab: 'messages', c: id } : { tab: 'messages' }, { replace: true }), [setParams]);
}

function Mentors() {
  const qc = useQueryClient();
  const open = useOpenConversation();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [requesting, setRequesting] = useState(null);
  const [message, setMessage] = useState('');
  const [ending, setEnding] = useState(null);
  const debounced = useDebounce(q, 300);
  const mine = useQuery({ queryKey: ['mentorships'], queryFn: mentorshipApi.mine });
  const dir = useQuery({ queryKey: ['mentor-directory', debounced, page], queryFn: () => mentorshipApi.directory({ q: debounced, page }), placeholderData: (p) => p });

  const request = useMutation({
    mutationFn: () => mentorshipApi.request(requesting._id, message),
    onSuccess: (res) => {
      toast.success(res.message);
      setRequesting(null);
      setMessage('');
      qc.invalidateQueries({ queryKey: ['mentorships'] });
      qc.invalidateQueries({ queryKey: ['mentor-directory'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const end = useMutation({
    mutationFn: (id) => mentorshipApi.end(id),
    onSuccess: (res) => {
      toast.success(res.message);
      setEnding(null);
      qc.invalidateQueries({ queryKey: ['mentorships'] });
      qc.invalidateQueries({ queryKey: ['mentor-directory'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const message1 = useMutation({
    mutationFn: (userId) => chatApi.direct(userId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      open(res.data._id);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const my = mine.data?.data || [];
  return (
    <div className="stack" style={{ '--gap': '24px' }}>
      <section aria-labelledby="my-mentors">
        <h2 id="my-mentors" style={{ fontSize: '1.05rem' }}>My mentors</h2>
        {mine.isLoading ? (
          <CardSkeleton />
        ) : my.length === 0 ? (
          <div className="card"><EmptyState icon={UserPlus} title="No mentor yet">Browse mentors below and send a short request explaining what you'd like help with.</EmptyState></div>
        ) : (
          <div className="grid-3">
            {my.map((m) => (
              <div key={m._id} className="card stack" style={{ '--gap': '10px' }}>
                <div className="row">
                  <Avatar name={m.mentor.name} size={42} />
                  <div className="flex-1">
                    <div className="bold">{m.mentor.name}</div>
                    <div className="xs muted">{m.mentor.mentorProfile?.designation} · {m.mentor.mentorProfile?.company}</div>
                  </div>
                  <Badge tone={m.status === 'active' ? 'success' : 'warning'}>{m.status === 'active' ? 'Active' : 'Pending'}</Badge>
                </div>
                <div className="row" style={{ '--gap': '8px' }}>
                  {m.status === 'active' && (
                    <Button size="sm" variant="primary" icon={MessagesSquare} loading={message1.isPending} onClick={() => message1.mutate(m.mentor._id)}>
                      Message
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEnding(m)}>
                    {m.status === 'active' ? 'End mentorship' : 'Withdraw request'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="find-mentors">
        <div className="row-between mb-2">
          <h2 id="find-mentors" style={{ fontSize: '1.05rem', margin: 0 }}>Find a mentor</h2>
          <div style={{ width: 'min(100%, 320px)' }}>
            <TextField label={<span className="sr-only">Search mentors</span>} icon={Search} placeholder="Search by skill, company or name" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
          </div>
        </div>
        {dir.error ? (
          <ErrorState error={dir.error} onRetry={dir.refetch} />
        ) : dir.isLoading ? (
          <div className="grid-3"><CardSkeleton /><CardSkeleton /></div>
        ) : dir.data.data.items.length === 0 ? (
          <div className="card"><EmptyState icon={Users} title="No mentors found">Try a different keyword.</EmptyState></div>
        ) : (
          <>
            <div className="grid-3">
              {dir.data.data.items.map((m) => (
                <article key={m._id} className="card stack" style={{ '--gap': '10px' }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <Avatar name={m.name} size={44} />
                    <div className="flex-1">
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>{m.name}</h3>
                      <div className="xs muted">{m.mentorProfile?.designation} · {m.mentorProfile?.company}</div>
                      <div className="xs subtle">{m.mentorProfile?.experienceYears} yrs experience · active {timeAgo(m.lastActiveAt)}</div>
                    </div>
                  </div>
                  {m.bio && <p className="small muted mb-0" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.bio}</p>}
                  <div className="chips">
                    {(m.mentorProfile?.expertise || []).slice(0, 5).map((e) => <span key={e} className="badge">{e}</span>)}
                  </div>
                  {m.mentorProfile?.availability && <p className="xs subtle mb-0">Availability: {m.mentorProfile.availability}</p>}
                  <div style={{ marginTop: 'auto' }}>
                    {m.myStatus === 'active' ? (
                      <Badge tone="success">Your mentor</Badge>
                    ) : m.myStatus === 'pending' ? (
                      <Badge tone="warning">Request sent</Badge>
                    ) : m.isFull ? (
                      <Badge>Not taking new mentees</Badge>
                    ) : (
                      <Button size="sm" icon={UserPlus} onClick={() => setRequesting(m)}>
                        Request mentorship
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <Pagination pagination={dir.data.data.pagination} onPage={setPage} />
          </>
        )}
      </section>

      <Modal
        open={Boolean(requesting)}
        onClose={() => setRequesting(null)}
        title={`Request ${requesting?.name} as your mentor`}
        footer={
          <>
            <Button onClick={() => setRequesting(null)}>Cancel</Button>
            <Button variant="primary" loading={request.isPending} onClick={() => request.mutate()}>Send request</Button>
          </>
        }
      >
        <TextAreaField
          label="Introduce yourself (recommended)"
          rows={4}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hi! I'm a 3rd-year B.Tech student aiming for a data analyst role. I'd love guidance on projects and interview prep."
          data-autofocus
        />
      </Modal>
      <ConfirmDialog
        open={Boolean(ending)}
        onClose={() => setEnding(null)}
        onConfirm={() => end.mutate(ending._id)}
        loading={end.isPending}
        title={ending?.status === 'active' ? 'End this mentorship?' : 'Withdraw your request?'}
        message={ending?.status === 'active' ? `You will no longer be able to message ${ending?.mentor.name}. Past messages remain visible.` : 'The mentor will no longer see your request.'}
        confirmLabel={ending?.status === 'active' ? 'End mentorship' : 'Withdraw'}
        danger={ending?.status === 'active'}
      />
    </div>
  );
}

function Communities() {
  const qc = useQueryClient();
  const open = useOpenConversation();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', tags: '' });
  const [errors, setErrors] = useState({});
  const debounced = useDebounce(q, 300);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['communities', debounced], queryFn: () => communityApi.list({ q: debounced, limit: 48 }) });
  const join = useMutation({
    mutationFn: (c) => (c.joined ? communityApi.leave(c._id) : communityApi.join(c._id)),
    onSuccess: (res, c) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['communities'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (!c.joined && c.conversation) open(c.conversation);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const create = useMutation({
    mutationFn: () => communityApi.create({ name: form.name, description: form.description, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8) }),
    onSuccess: (res) => {
      toast.success(res.message);
      setCreating(false);
      setForm({ name: '', description: '', tags: '' });
      qc.invalidateQueries({ queryKey: ['communities'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      open(res.data.conversation);
    },
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });

  return (
    <>
      <div className="row-between mb-2">
        <div style={{ width: 'min(100%, 360px)' }}>
          <TextField label={<span className="sr-only">Search communities</span>} icon={Search} placeholder="Search communities" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button icon={Plus} variant="primary" onClick={() => setCreating(true)}>New community</Button>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : data.data.items.length === 0 ? (
        <div className="card"><EmptyState icon={Hash} title="No communities found">Start one around your interest!</EmptyState></div>
      ) : (
        <div className="grid-3">
          {data.data.items.map((c) => (
            <article key={c._id} className="card stack" style={{ '--gap': '8px' }}>
              <div className="row-between">
                <h3 style={{ margin: 0, fontSize: '1rem' }} className="row">
                  <Hash size={16} aria-hidden="true" /> {c.name}
                </h3>
                {c.isOfficial && <Badge tone="primary">Official</Badge>}
              </div>
              <p className="small muted mb-0" style={{ flex: 1 }}>{c.description}</p>
              <div className="chips">{(c.tags || []).map((t) => <span key={t} className="badge">#{t}</span>)}</div>
              <div className="row-between">
                <span className="xs muted row" style={{ '--gap': '4px' }}><Users size={12} aria-hidden="true" /> {c.memberCount} members</span>
                <div className="row" style={{ '--gap': '6px' }}>
                  {c.joined && <Button size="sm" variant="primary" onClick={() => open(c.conversation)}>Open chat</Button>}
                  <Button size="sm" variant={c.joined ? 'ghost' : 'default'} loading={join.isPending && join.variables?._id === c._id} onClick={() => join.mutate(c)}>
                    {c.joined ? 'Leave' : 'Join'}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create a community"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()} disabled={form.name.trim().length < 3}>Create</Button>
          </>
        }
      >
        <div className="stack">
          <TextField label="Name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} data-autofocus />
          <TextAreaField label="What is it about?" rows={3} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField label="Tags" hint="Comma separated, e.g. python, placements" maxLength={200} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <p className="xs muted mb-0">Communities follow our Terms: be respectful, no spam, never ask for money.</p>
        </div>
      </Modal>
    </>
  );
}

export function Connect() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'messages';
  const selected = params.get('c');
  const onSelect = useCallback((id) => setParams(id ? { tab: 'messages', c: id } : { tab: 'messages' }, { replace: true }), [setParams]);
  return (
    <>
      <PageTitle title="Connect" subtitle="Talk to your mentors and learn with peers in communities." />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'messages', label: 'Messages', icon: MessagesSquare },
          { value: 'mentors', label: 'Mentors', icon: UserPlus },
          { value: 'communities', label: 'Communities', icon: Hash },
        ]}
      />
      {tab === 'messages' && <ChatWorkspace selectedId={selected} onSelect={onSelect} emptyHint="Connect with a mentor or join a community to start chatting." />}
      {tab === 'mentors' && <Mentors />}
      {tab === 'communities' && <Communities />}
    </>
  );
}
