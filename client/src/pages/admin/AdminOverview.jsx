import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, BadgeCheck, Briefcase, CalendarDays, GraduationCap, Hash, HeartPulse, UserPlus, Users } from 'lucide-react';
import { adminApi, healthApi } from '../../services/api';
import { PageTitle } from '../../components/common/PageTitle';
import { Alert, Badge, Button, CardSkeleton, ErrorState, StatCard } from '../../components/ui';
import { BarList, ChartCard, ColumnChart } from '../../components/charts/Charts';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

const shortDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function HealthStrip() {
  const { data } = useQuery({ queryKey: ['health'], queryFn: healthApi.ready, refetchInterval: 60_000 });
  if (!data) return null;
  const c = data.checks;
  const items = [
    ['Database', c.database.ok],
    [`Email (${c.email.transport})`, c.email.ok],
    [`AI (${c.ai.providersConfigured.length ? c.ai.providersConfigured.join(', ') : 'library fallback'})`, true],
    ['Realtime', c.realtime.ok],
    [`Server (${c.process.eventLoopLagMs}ms lag)`, c.process.ok],
  ];
  return (
    <div className="card row mb-2" style={{ '--gap': '8px', padding: 12 }} aria-label="System health">
      <Activity size={16} aria-hidden="true" />
      <span className="small bold">System</span>
      {items.map(([label, ok]) => (
        <Badge key={label} tone={ok ? 'success' : 'danger'}>{ok ? '●' : '▲'} {label}</Badge>
      ))}
      <Link to="/admin/system" className="small" style={{ marginLeft: 'auto' }}>Details</Link>
    </div>
  );
}

export function AdminOverview() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats, refetchInterval: 5 * 60_000 });
  const header = <PageTitle title="Overview" docTitle="Admin overview" subtitle="Registrations, engagement and readiness across the platform." actions={<Button to="/admin/students" icon={GraduationCap}>Student records</Button>} />;
  if (isLoading) return <>{header}<div className="grid-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div></>;
  if (error) return <>{header}<ErrorState error={error} onRetry={refetch} /></>;
  const s = data.data;
  const signups = s.signups.map((d) => ({ label: shortDay(d.day), short: shortDay(d.day), value: d.count }));
  const total30 = s.signups.reduce((n, d) => n + d.count, 0);
  // API groups are { label, count }; charts and tables read { label, value }.
  const asSeries = (rows) => rows.map((r) => ({ label: r.label || "Unknown", value: r.count }));
  const byTrack = asSeries(s.byTrack);
  const byCollege = asSeries(s.byCollege);
  const byDegree = asSeries(s.byDegree);
  const bySource = asSeries(s.bySource);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <>
      {header}
      <ErrorBoundary variant="section"><HealthStrip /></ErrorBoundary>
      {s.totals.pendingMentors > 0 && (
        <Alert type="warning" className="mb-2" title={`${s.totals.pendingMentors} mentor application${s.totals.pendingMentors > 1 ? 's' : ''} waiting for review`}>
          <Link to="/admin/mentors?status=pending">Review applications →</Link>
        </Alert>
      )}
      <div className="grid-4 mb-2">
        <StatCard icon={GraduationCap} label="Students" value={s.totals.students.toLocaleString('en-IN')} hint={`${s.totals.verified} verified email`} />
        <StatCard icon={UserPlus} label="New this week" value={s.totals.newThisWeek} tone="info" hint={`${total30} in the last 30 days`} />
        <StatCard icon={Activity} label="Active this week" value={s.totals.activeThisWeek} tone="success" hint={s.totals.students ? `${Math.round((s.totals.activeThisWeek / s.totals.students) * 100)}% of students` : ''} />
        <StatCard icon={BadgeCheck} label="Avg. readiness" value={`${s.readiness.average}/100`} tone="warning" hint={`${s.readiness.high} job-ready (70+)`} />
        <StatCard icon={Users} label="Active mentors" value={s.totals.mentors} hint={`${s.totals.mentorships} active mentorships`} />
        <StatCard icon={Briefcase} label="Open opportunities" value={s.content.opportunities} hint={`${plural(s.engagement.applications, "application")} tracked`} />
        <StatCard icon={CalendarDays} label="Upcoming sessions" value={s.content.upcomingSessions} hint={`${s.content.communities} communities`} />
        <StatCard icon={HeartPulse} label="Wellness check-ins (7d)" value={s.engagement.wellnessCheckins7d} tone="danger" hint={`Avg roadmap progress ${s.engagement.avgRoadmapProgress}%`} />
      </div>

      <div className="grid-2">
        <div className="span-full">
          <ChartCard title="New student registrations" subtitle="Per day, last 30 days (IST)" rows={signups.map((d) => ({ label: d.label, value: d.value }))} columns={['Day', 'Registrations']}>
            <ColumnChart data={signups} height={210} tickEvery={5} valueLabel={(v) => `${v} registration${v === 1 ? '' : 's'}`} ariaLabel={`Daily registrations over the last 30 days, ${total30} in total`} />
          </ChartCard>
        </div>
        <ChartCard title="Students by career track" subtitle="Top tracks students follow" rows={byTrack} columns={['Track', 'Students']}>
          <BarList data={byTrack} ariaLabel="Students by career track" />
        </ChartCard>
        <ChartCard title="Top colleges" rows={byCollege} columns={['College', 'Students']}>
          <BarList data={byCollege} ariaLabel="Students by college" />
        </ChartCard>
        <ChartCard title="Degrees" rows={byDegree} columns={['Degree', 'Students']}>
          <BarList data={byDegree} ariaLabel="Students by degree" />
        </ChartCard>
        <ChartCard title="Sign-up sources" subtitle="From consented campaign links (UTM)" rows={bySource} columns={['Source', 'Students']}>
          <BarList data={bySource} ariaLabel="Students by sign-up source" />
        </ChartCard>
        <ChartCard title="Readiness distribution" subtitle="Students by readiness score band" rows={[{ label: 'Getting started (0–39)', value: s.readiness.low }, { label: 'Progressing (40–69)', value: s.readiness.mid }, { label: 'Job-ready (70–100)', value: s.readiness.high }]} columns={['Band', 'Students']}>
          <BarList data={[{ label: 'Getting started (0–39)', value: s.readiness.low }, { label: 'Progressing (40–69)', value: s.readiness.mid }, { label: 'Job-ready (70–100)', value: s.readiness.high }]} ariaLabel="Readiness distribution" />
        </ChartCard>
        <section className="card" aria-labelledby="quick-h">
          <div className="card-header">
            <h2 id="quick-h">Quick actions</h2>
          </div>
          <div className="stack" style={{ '--gap': '8px' }}>
            <Button to="/admin/students" icon={GraduationCap} block>Export student records to Excel</Button>
            <Button to="/admin/mentors" icon={Users} block>Add a mentor</Button>
            <Button to="/admin/sessions" icon={CalendarDays} block>Schedule a seminar</Button>
            <Button to="/admin/content?tab=announce" icon={Hash} block>Send an announcement</Button>
          </div>
        </section>
      </div>
    </>
  );
}
