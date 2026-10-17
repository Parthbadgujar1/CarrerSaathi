import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, CalendarDays, Compass, Flame, HeartPulse, Target } from 'lucide-react';
import { studentApi, roadmapApi, wellnessApi, mentorshipApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { getErrorMessage } from '../../lib/http';
import { PageTitle } from '../../components/common/PageTitle';
import { Avatar, Badge, Button, CardSkeleton, EmptyState, ErrorState, ProgressBar, ProgressRing } from '../../components/ui';
import { MeetingCard } from '../../components/meetings/MeetingCard';
import { OpportunityCard } from '../../components/opportunities/OpportunityCard';
import { roadmapIcon } from '../../components/roadmap/RoadmapParts';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { MOODS } from './Wellness';

const greeting = () => {
  const h = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const streakLabel = (n, noun) => (n > 0 ? `${n}-day ${noun}` : `Start a ${noun}`);

export function StudentHome() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['student-dashboard'], queryFn: studentApi.dashboard });

  const stepMut = useMutation({
    mutationFn: ({ roadmapId, key }) => roadmapApi.toggleStep(roadmapId, key, true),
    onSuccess: () => {
      toast.success('Nice work! Step completed.');
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const moodMut = useMutation({
    mutationFn: (mood) => wellnessApi.checkin({ mood }),
    onSuccess: () => {
      toast.success('Check-in saved. Thanks for looking after yourself!');
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
      qc.invalidateQueries({ queryKey: ['wellness'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const goalMut = useMutation({
    mutationFn: (id) => mentorshipApi.updateNote(id, { done: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-dashboard'] }),
  });

  const firstName = user.name.split(' ')[0];
  const title = <PageTitle title={`${greeting()}, ${firstName}`} docTitle="Dashboard" subtitle="Here's where you are on your career journey today." />;

  if (isLoading) {
    return (
      <>
        {title}
        <div className="dash-layout">
          <div className="dash-col">
            <CardSkeleton lines={5} />
            <CardSkeleton lines={3} />
          </div>
          <div className="dash-col">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={3} />
          </div>
        </div>
      </>
    );
  }
  if (error) return <>{title}<ErrorState error={error} onRetry={refetch} /></>;

  const d = data.data;
  const r = d.readiness;
  const nextAction = [...r.breakdown].sort((a, b) => a.score / a.max - b.score / b.max)[0];
  const actionLink = { profile: '/app/profile', careerKit: '/app/profile?tab=kit', roadmap: '/app/roadmap', engagement: '/app/wellness' }[nextAction.key];
  const mood = MOODS.find((m) => m.value === d.wellness.mood);

  return (
    <>
      {title}
      <div className="dash-layout">
        {/* ---------------- Main column ---------------- */}
        <div className="dash-col">
          <section className="card" aria-labelledby="next-h">
            <div className="card-header">
              <h2 id="next-h">Next steps</h2>
              <span className="card-meta" title="Days in a row with roadmap progress">
                <Flame color="var(--warning)" aria-hidden="true" /> {streakLabel(d.learningStreak, 'learning streak')}
              </span>
            </div>
            {d.nextSteps.length === 0 ? (
              <EmptyState icon={Compass} title="Pick your first roadmap" action={<Button size="sm" variant="primary" to="/app/roadmap">Choose a roadmap</Button>}>
                Follow a roadmap to get a clear list of next steps here.
              </EmptyState>
            ) : (
              <ul className="list-plain">
                {d.nextSteps.map((s) => (
                  <li key={s.key} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      className="step-check"
                      aria-label={`Mark "${s.title}" as done`}
                      disabled={stepMut.isPending}
                      onChange={() => stepMut.mutate({ roadmapId: s.roadmapId, key: s.key })}
                    />
                    <div className="flex-1">
                      <Link to={`/app/roadmap/${s.slug}`} className="bold" style={{ color: 'var(--text)' }}>
                        {s.title}
                      </Link>
                      <div className="xs muted">
                        {s.roadmapTitle} · {s.phase}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {d.goals.length > 0 && (
              <div className="mt-2" style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <h3 className="small row mb-1" style={{ '--gap': '6px' }}>
                  <Target size={15} aria-hidden="true" /> Goals from your mentor
                </h3>
                <ul className="list-plain">
                  {d.goals.map((g) => (
                    <li key={g._id} className="list-row" style={{ alignItems: 'flex-start' }}>
                      <input type="checkbox" className="step-check" aria-label={`Mark goal as done: ${g.text}`} onChange={() => goalMut.mutate(g._id)} />
                      <div className="flex-1">
                        <div className="small">{g.text}</div>
                        <div className="xs subtle">— {g.mentor?.name}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <ErrorBoundary variant="section">
            <section className="card" aria-labelledby="paths-h">
              <div className="card-header">
                <h2 id="paths-h">My roadmaps</h2>
                <Link to="/app/roadmap" className="small">Manage</Link>
              </div>
              {d.enrollments.length === 0 ? (
                <EmptyState icon={Compass} title="No roadmaps yet" action={<Button size="sm" variant="primary" to="/app/roadmap?tab=planner">Generate one with AI</Button>}>
                  Choose from the library or let the AI planner build one for your goals.
                </EmptyState>
              ) : (
                <ul className="list-plain">
                  {d.enrollments.map((e) => {
                    const Icon = roadmapIcon(e.roadmap.icon);
                    return (
                      <li key={e._id} className="list-row">
                        <span className="stat-icon">
                          <Icon aria-hidden="true" />
                        </span>
                        <div className="flex-1" style={{ minWidth: 0 }}>
                          <div className="row-between" style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
                            <Link to={`/app/roadmap/${e.roadmap.slug}`} className="small bold truncate" style={{ color: 'var(--text)' }}>
                              {e.roadmap.title}
                            </Link>
                            <span className="small bold nowrap">{e.progress}%</span>
                          </div>
                          <ProgressBar value={e.progress} small label={`${e.roadmap.title} progress`} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </ErrorBoundary>

          <section aria-labelledby="opps-h">
            <div className="row-between mb-2">
              <h2 id="opps-h" style={{ fontSize: '1.1rem', margin: 0 }}>
                Opportunities for you
              </h2>
              <Link to="/app/opportunities" className="small">See all</Link>
            </div>
            {d.opportunities.length === 0 ? (
              <div className="card">
                <EmptyState title="Nothing new right now">Check “Explore platforms” on the Opportunities page for live listings.</EmptyState>
              </div>
            ) : (
              <div className="grid-2">
                {d.opportunities.map((o) => (
                  <OpportunityCard key={o._id} opp={o} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ---------------- Side column ---------------- */}
        <aside className="dash-col" aria-label="Your progress at a glance">
          <section className="card" aria-labelledby="ready-h">
            <div className="card-header">
              <h2 id="ready-h">Industry readiness</h2>
              <Badge tone={r.score >= 70 ? 'success' : r.score >= 40 ? 'primary' : 'warning'}>
                {r.score >= 70 ? 'Job-ready' : r.score >= 40 ? 'Progressing' : 'Getting started'}
              </Badge>
            </div>
            <div className="readiness">
              <ProgressRing value={r.score} size={112} label="Readiness score" sublabel="of 100" />
              <ul className="readiness-list">
                {r.breakdown.map((b) => (
                  <li key={b.key} className="metric-row">
                    <span className="metric-label">{b.label}</span>
                    <span className="metric-value">
                      {b.score}/{b.max}
                    </span>
                    <ProgressBar value={(b.score / b.max) * 100} small label={b.label} />
                  </li>
                ))}
              </ul>
            </div>
            <Link to={actionLink} className="card-footer-link">
              Biggest boost: improve {nextAction.label.toLowerCase()} <ArrowRight aria-hidden="true" />
            </Link>
          </section>

          <section className="card" aria-labelledby="well-h">
            <div className="card-header">
              <h2 id="well-h">How are you feeling?</h2>
              <span className="card-meta">
                <HeartPulse color="var(--danger)" aria-hidden="true" /> {streakLabel(d.wellness.streak, 'check-in streak')}
              </span>
            </div>
            {d.wellness.checkedInToday ? (
              <div className="stack" style={{ '--gap': '10px' }}>
                <p className="mb-0">
                  Today you're feeling <strong>{mood?.label.toLowerCase()}</strong> {mood?.emoji}
                </p>
                <p className="small muted mb-0">Add sleep, exercise or a private journal note on the Wellness page.</p>
                <div>
                  <Button size="sm" to="/app/wellness">Open wellness</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mood-picker mood-picker-fill" role="group" aria-label="Quick mood check-in">
                  {MOODS.map((m) => (
                    <button key={m.value} type="button" className="mood-btn" onClick={() => moodMut.mutate(m.value)} disabled={moodMut.isPending}>
                      <span className="emoji" aria-hidden="true">{m.emoji}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="xs subtle mt-1 mb-0">Private to you. One tap keeps your streak going.</p>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="sessions-h">
            <div className="card-header">
              <h2 id="sessions-h">Upcoming sessions</h2>
              <Link to="/app/opportunities?tab=sessions" className="small">All sessions</Link>
            </div>
            {d.meetings.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No sessions scheduled">Seminars and mentor sessions will appear here.</EmptyState>
            ) : (
              <div className="stack" style={{ '--gap': '0' }}>
                {d.meetings.map((m) => (
                  <MeetingCard key={m._id} meeting={{ ...m, attendeeCount: m.attendees?.length, attending: m.attendees?.includes(user._id) }} compact />
                ))}
              </div>
            )}
            {d.mentors.length > 0 && (
              <div className="mt-2" style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <h3 className="small mb-1">Your mentor{d.mentors.length > 1 ? 's' : ''}</h3>
                {d.mentors.map((m) => (
                  <div key={m._id} className="row" style={{ flexWrap: 'nowrap' }}>
                    <Avatar name={m.name} size={34} />
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="small bold truncate">{m.name}</div>
                      <div className="xs muted truncate">
                        {m.mentorProfile?.designation} · {m.mentorProfile?.company}
                      </div>
                    </div>
                    <Button size="sm" to="/app/connect">Message</Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
