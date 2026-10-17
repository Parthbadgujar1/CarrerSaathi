import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarDays, Check, GraduationCap, MessagesSquare, UserPlus, X } from 'lucide-react';
import { chatApi, meetingApi, mentorshipApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { getErrorMessage } from '../../lib/http';
import { timeAgo } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Avatar, Badge, Button, CardSkeleton, EmptyState, ErrorState, ProgressBar, StatCard } from '../../components/ui';
import { MeetingCard } from '../../components/meetings/MeetingCard';

export function MentorHome() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['mentorships'], queryFn: mentorshipApi.mine });
  const meetings = useQuery({ queryKey: ['meetings', 'upcoming'], queryFn: () => meetingApi.list({ when: 'upcoming', limit: 4 }) });
  const convos = useQuery({ queryKey: ['conversations'], queryFn: chatApi.conversations });
  const respond = useMutation({
    mutationFn: ({ id, accept }) => mentorshipApi.respond(id, accept),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['mentorships'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const all = mine.data?.data || [];
  const active = all.filter((m) => m.status === 'active');
  const pending = all.filter((m) => m.status === 'pending');
  const unread = (convos.data?.data || []).reduce((n, c) => n + (c.unread || 0), 0);
  const avgReadiness = active.length ? Math.round(active.reduce((s, m) => s + (m.student.readinessScore || 0), 0) / active.length) : null;

  return (
    <>
      <PageTitle title={`Welcome, ${user.name.split(' ')[0]}`} docTitle="Mentor dashboard" subtitle="Your mentees, requests and sessions at a glance." />
      <div className="grid-4 mb-2">
        <StatCard icon={GraduationCap} label="Active mentees" value={mine.isLoading ? '…' : active.length} hint={`Capacity ${user.mentorProfile?.maxMentees || 25}`} />
        <StatCard icon={UserPlus} label="Pending requests" value={mine.isLoading ? '…' : pending.length} tone="warning" />
        <StatCard icon={MessagesSquare} label="Unread messages" value={unread} tone="info" />
        <StatCard icon={CalendarDays} label="Mentee avg. readiness" value={avgReadiness ?? '—'} hint="out of 100" tone="success" />
      </div>

      <div className="dash-layout">
        <div className="dash-col">
          {pending.length > 0 && (
            <section className="card" aria-labelledby="req-h">
              <div className="card-header">
                <h2 id="req-h">Mentorship requests</h2>
                <Badge tone="warning">{pending.length} waiting</Badge>
              </div>
              <ul className="list-plain">
                {pending.map((m) => (
                  <li key={m._id} className="list-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <Avatar name={m.student.name} />
                    <div className="flex-1" style={{ minWidth: 200 }}>
                      <div className="bold small">{m.student.name}</div>
                      <div className="xs muted">{[m.student.education?.degree, m.student.education?.branch, m.student.education?.college].filter(Boolean).join(' · ')}</div>
                      {m.requestMessage && <p className="small mt-1 mb-0" style={{ background: 'var(--bg-subtle)', padding: '8px 10px', borderRadius: 8 }}>“{m.requestMessage}”</p>}
                    </div>
                    <div className="row" style={{ '--gap': '6px' }}>
                      <Button size="sm" variant="primary" icon={Check} loading={respond.isPending && respond.variables?.id === m._id && respond.variables.accept} onClick={() => respond.mutate({ id: m._id, accept: true })}>Accept</Button>
                      <Button size="sm" icon={X} onClick={() => respond.mutate({ id: m._id, accept: false })}>Decline</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card" aria-labelledby="mentees-h">
            <div className="card-header">
              <h2 id="mentees-h">My mentees</h2>
              <Link to="/mentor/students" className="small">View all students</Link>
            </div>
            {mine.error ? (
              <ErrorState error={mine.error} onRetry={mine.refetch} />
            ) : mine.isLoading ? (
              <CardSkeleton />
            ) : active.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No mentees yet">Students can request you from the mentor directory, or an admin can assign mentees.</EmptyState>
            ) : (
              <ul className="list-plain">
                {active.map((m) => (
                  <li key={m._id} className="list-row">
                    <Avatar name={m.student.name} />
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="row-between" style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
                        <Link to={`/mentor/students?student=${m.student._id}`} className="bold small truncate" style={{ color: 'var(--text)' }}>{m.student.name}</Link>
                        <span className="xs muted nowrap">Readiness <strong style={{ color: 'var(--text)' }}>{m.student.readinessScore || 0}</strong></span>
                      </div>
                      <ProgressBar value={m.student.readinessScore || 0} small label={`${m.student.name} readiness`} />
                      <div className="xs subtle mt-1 truncate">{m.student.education?.college} · active {timeAgo(m.student.lastActiveAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="dash-col" aria-label="Sessions and shortcuts">
          <section className="card" aria-labelledby="up-h">
            <div className="card-header">
              <h2 id="up-h">Upcoming sessions</h2>
              <Link to="/mentor/sessions" className="small">Schedule</Link>
            </div>
            {meetings.isLoading ? (
              <CardSkeleton />
            ) : (meetings.data?.data?.items || []).length === 0 ? (
              <EmptyState icon={CalendarDays} title="Nothing scheduled" action={<Button size="sm" variant="primary" to="/mentor/sessions">Schedule a session</Button>}>Host a mock interview, doubt-clearing session or workshop.</EmptyState>
            ) : (
              <div>
                {meetings.data.data.items.map((m) => <MeetingCard key={m._id} meeting={m} compact actions={<span />} />)}
              </div>
            )}
          </section>
          <section className="card" aria-labelledby="quick-h">
            <div className="card-header">
              <h2 id="quick-h">Quick actions</h2>
            </div>
            <div className="stack" style={{ '--gap': '8px' }}>
              <Button block to="/mentor/students" icon={GraduationCap}>Review student progress</Button>
              <Button block to="/mentor/messages" icon={MessagesSquare}>Open messages</Button>
              <Button block to="/mentor/sessions" icon={CalendarDays}>Schedule a session</Button>
              <Button block to="/mentor/opportunities" icon={UserPlus}>Post an opportunity</Button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
