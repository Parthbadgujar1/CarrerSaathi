import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarClock, ClipboardCheck, Clock, History, Play, Sparkles, Target, Trophy } from 'lucide-react';
import { practiceApi, testApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { fmtDateTime, timeAgo } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Badge, Button, CardSkeleton, EmptyState, ErrorState, SelectField, Tabs, TextField } from '../../components/ui';
import { ChartCard, LineChart } from '../../components/charts/Charts';

const STATE_TONE = { open: 'success', upcoming: 'info', closed: '' };

function AssignedTests() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['student-tests'], queryFn: testApi.list, refetchInterval: 60_000 });
  const start = useMutation({
    mutationFn: (id) => testApi.start(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['student-tests'] });
      navigate(`/app/tests/attempt/${res.data.attempt._id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  if (isLoading) return <CardSkeleton count={3} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const tests = data.data;
  if (!tests.length) return <EmptyState icon={ClipboardCheck} title="No tests assigned yet">When your college or mentors schedule a test for you, it appears here and you get a notification.</EmptyState>;
  return (
    <div className="stack">
      {tests.map((t) => {
        const left = t.maxAttempts - t.attemptsUsed;
        return (
          <div key={t._id} className="card stack" style={{ '--gap': '10px' }}>
            <div className="row-between">
              <h3 className="mb-0">{t.title}</h3>
              <Badge tone={STATE_TONE[t.state]}>{t.state === 'open' ? 'Open now' : t.state === 'upcoming' ? 'Upcoming' : 'Closed'}</Badge>
            </div>
            {t.description && <p className="small muted mb-0">{t.description}</p>}
            <div className="row small muted">
              <span className="row" style={{ '--gap': '4px' }}><CalendarClock size={15} aria-hidden="true" /> {fmtDateTime(t.startAt)} → {fmtDateTime(t.endAt)}</span>
              <span className="row" style={{ '--gap': '4px' }}><Clock size={15} aria-hidden="true" /> {t.durationMinutes} min</span>
              <span>{t.questionCount} questions · {t.totalMarks} marks</span>
              <span>Pass at {t.passPercent}%</span>
            </div>
            <div className="row-between">
              <div className="small">
                {t.best ? (
                  <span>Best score <strong>{t.best.percent}%</strong> <Badge tone={t.best.passed ? 'success' : 'warning'}>{t.best.passed ? 'Passed' : 'Not passed'}</Badge></span>
                ) : (
                  <span className="muted">Not attempted</span>
                )}
                <span className="muted"> · {Math.max(0, left)} attempt{left === 1 ? '' : 's'} left</span>
              </div>
              <div className="row">
                {t.best && <Button size="sm" to={`/app/tests/attempt/${t.best.attemptId}`}>View result</Button>}
                {t.state === 'open' && (t.inProgressAttemptId || left > 0) && (
                  <Button variant="primary" size="sm" icon={Play} loading={start.isPending && start.variables === t._id} onClick={() => start.mutate(t._id)}>
                    {t.inProgressAttemptId ? 'Resume test' : 'Start test'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Practice() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const options = useQuery({ queryKey: ['practice-options'], queryFn: practiceApi.options });
  const history = useQuery({ queryKey: ['practice-history'], queryFn: practiceApi.history });
  const [form, setForm] = useState({ roadmapId: '', phaseIndex: '', topic: '', count: 10, difficulty: 'medium' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const gen = useMutation({
    mutationFn: () => {
      const body = { count: Number(form.count), difficulty: form.difficulty };
      if (form.roadmapId) body.roadmapId = form.roadmapId;
      if (form.roadmapId && form.phaseIndex !== '') body.phaseIndex = Number(form.phaseIndex);
      if (form.topic.trim()) body.topic = form.topic.trim();
      return practiceApi.generate(body);
    },
    onSuccess: (res) => {
      if (res.data.notice) toast(res.data.notice, { icon: 'ℹ️', duration: 6000 });
      qc.invalidateQueries({ queryKey: ['practice-history'] });
      navigate(`/app/tests/practice/${res.data._id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (options.isLoading) return <CardSkeleton count={2} />;
  if (options.error) return <ErrorState error={options.error} onRetry={options.refetch} />;
  const { roadmaps, aiAvailable } = options.data.data;
  const roadmap = roadmaps.find((r) => r._id === form.roadmapId);
  const progress = history.data?.data?.roadmaps || [];

  return (
    <div className="stack">
      <form className="card stack" onSubmit={(e) => (e.preventDefault(), gen.mutate())}>
        <div>
          <h3 className="mb-0">Check your own progress</h3>
          <p className="small muted mb-0">
            {aiAvailable
              ? 'Get a short quiz on your roadmap or any topic. Results show which topics need more study.'
              : 'AI quizzes are not enabled yet, so you get a quick self-rating check built from your roadmap steps.'}
          </p>
        </div>
        <div className="grid-2">
          <SelectField
            label="Roadmap you follow"
            value={form.roadmapId}
            onChange={(e) => setForm((f) => ({ ...f, roadmapId: e.target.value, phaseIndex: '' }))}
            placeholder={roadmaps.length ? 'Choose a roadmap' : 'You are not following a roadmap yet'}
            options={roadmaps.map((r) => ({ value: r._id, label: `${r.title} (${r.progress ?? 0}%)` }))}
          />
          <SelectField
            label="Phase"
            value={form.phaseIndex}
            onChange={(e) => set('phaseIndex', e.target.value)}
            disabled={!roadmap}
            placeholder="Whole roadmap"
            options={(roadmap?.phases || []).map((p) => ({ value: String(p.index), label: `${p.index + 1}. ${p.title}` }))}
          />
        </div>
        {aiAvailable && (
          <div className="grid-3">
            <TextField label="Or any topic" value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. SQL joins" maxLength={120} />
            <SelectField label="Questions" value={form.count} onChange={(e) => set('count', e.target.value)} options={['5', '10', '15']} />
            <SelectField label="Difficulty" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)} options={['easy', 'medium', 'hard']} />
          </div>
        )}
        <div>
          <Button type="submit" variant="primary" icon={Sparkles} loading={gen.isPending} disabled={!form.roadmapId && !form.topic.trim()}>
            {aiAvailable ? 'Start practice' : 'Start self-check'}
          </Button>
        </div>
      </form>

      {progress.length > 0 && (
        <div className="grid-2 grid-top">
          {progress.map((r) => (
            <ChartCard key={r.roadmapId} title={r.title} subtitle={`${r.attempts} check${r.attempts > 1 ? 's' : ''} · average ${r.average}% · latest ${r.last}%`}
              rows={r.trend.map((v, i) => [`#${i + 1}`, `${v}%`])} columns={['Attempt', 'Score']}>
              <LineChart data={r.trend.map((v, i) => ({ label: `#${i + 1}`, value: v }))} yMax={100} valueLabel={(v) => `${v}%`} ariaLabel={`${r.title} practice score trend`} yTicks={[0, 50, 100]} />
            </ChartCard>
          ))}
        </div>
      )}

      {history.data?.data?.items?.length > 0 && (
        <div className="card">
          <h3>Recent practice</h3>
          <ul className="list-plain">
            {history.data.data.items.map((p) => (
              <li key={p._id} className="list-row">
                <div className="flex-1">
                  <Link to={`/app/tests/practice/${p._id}`} className="bold">{p.title}</Link>
                  <div className="xs muted">{p.kind === 'confidence' ? 'Self-rating' : 'Quiz'} · {timeAgo(p.submittedAt)}</div>
                </div>
                <Badge tone={p.percent >= 70 ? 'success' : p.percent >= 40 ? 'primary' : 'warning'}>{p.percent}%</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Results() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['test-results-me'], queryFn: testApi.resultsMe });
  if (isLoading) return <CardSkeleton count={2} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const rows = data.data;
  if (!rows.length) return <EmptyState icon={Trophy} title="No results yet">Finish a test and your score history will show up here.</EmptyState>;
  return (
    <div className="card">
      <ul className="list-plain">
        {rows.map((r) => (
          <li key={r._id} className="list-row">
            <div className="flex-1">
              <Link to={`/app/tests/attempt/${r._id}`} className="bold">{r.title}</Link>
              <div className="xs muted">{fmtDateTime(r.submittedAt)} · {r.score}/{r.total} marks</div>
            </div>
            <Badge tone={r.passed ? 'success' : 'warning'}>{r.percent}% · {r.passed ? 'Passed' : 'Not passed'}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StudentTests() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'tests';
  return (
    <>
      <PageTitle title="Tests & practice" subtitle="Scheduled tests from your college, plus self-checks to see how your study and roadmap are going." />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: 'tests', label: 'Assigned tests', icon: ClipboardCheck },
          { value: 'practice', label: 'Practice', icon: Target },
          { value: 'results', label: 'My results', icon: History },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === 'tests' && <AssignedTests />}
        {tab === 'practice' && <Practice />}
        {tab === 'results' && <Results />}
      </div>
    </>
  );
}
