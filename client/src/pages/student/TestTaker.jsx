import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { practiceApi, testApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { PageTitle } from '../../components/common/PageTitle';
import { Alert, Badge, Button, CardSkeleton, ConfirmDialog, ErrorState, ProgressRing } from '../../components/ui';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
const mmss = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${h ? `${h}:` : ''}${m}:${String(s % 60).padStart(2, '0')}`;
};

function Choices({ options, value, onChange, correct, disabled }) {
  return (
    <div className="stack" style={{ '--gap': '8px' }} role="radiogroup">
      {options.map((o, i) => {
        const review = correct !== undefined;
        const cls = review ? (i === correct ? 'is-right' : value === i ? 'is-wrong' : '') : '';
        return (
          <button key={i} type="button" role="radio" aria-checked={value === i} className={`choice ${cls}`} disabled={disabled} onClick={() => onChange?.(i)}>
            <span className="key">{KEYS[i]}</span>
            <span>{o}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Result + answer review, shared by tests and practice quizzes. */
export function ResultView({ result, back, backLabel, extra }) {
  const passed = result.passed;
  const timeTaken = result.timeTakenSec ? `${Math.floor(result.timeTakenSec / 60)}m ${result.timeTakenSec % 60}s` : null;
  return (
    <div className="stack">
      <div className="card row" style={{ gap: 24 }}>
        <ProgressRing value={result.percent} label="Score" sublabel={`${result.percent}%`} />
        <div className="flex-1 stack" style={{ '--gap': '6px' }}>
          <h2 className="mb-0">{result.test?.title || result.title}</h2>
          <div className="row">
            {passed !== undefined && <Badge tone={passed ? 'success' : 'warning'}>{passed ? 'Passed' : 'Not passed'}</Badge>}
            {result.kind === 'confidence' ? <Badge>Self-rating</Badge> : <Badge tone="primary">{result.score} / {result.total} {result.test ? 'marks' : 'correct'}</Badge>}
            {timeTaken && <span className="small muted">Time taken {timeTaken}</span>}
            {result.autoSubmitted && <Badge tone="warning">Auto-submitted when time ended</Badge>}
          </div>
          {extra}
        </div>
        <Button to={back} icon={ArrowLeft}>{backLabel}</Button>
      </div>

      {result.reviewAvailable === false && (
        <Alert type="info" title="Answers are hidden for now">
          {result.test?.showResults === 'never' ? 'Your teacher chose not to show the answer key for this test.' : 'You can review the correct answers after the test window closes.'}
        </Alert>
      )}

      {result.review?.map((q, i) => (
        <div key={q._id || i} className="card stack" style={{ '--gap': '10px' }}>
          <div className="row-between">
            <strong>{i + 1}. {q.text}</strong>
            {result.kind === 'confidence' ? (
              <Badge tone={q.weak ? 'warning' : 'success'}>{q.rating ? `Rated ${q.rating}/5` : 'Not rated'}</Badge>
            ) : q.isCorrect ? (
              <Badge tone="success" icon={CheckCircle2}>Correct</Badge>
            ) : (
              <Badge tone="danger" icon={XCircle}>{(q.chosen ?? null) === null ? 'Skipped' : 'Incorrect'}</Badge>
            )}
          </div>
          {result.kind !== 'confidence' && <Choices options={q.options} value={q.chosen ?? undefined} correct={q.correct} disabled />}
          {q.explanation && <p className="small muted mb-0"><strong>Why:</strong> {q.explanation}</p>}
        </div>
      ))}

      {result.weakTopics?.length > 0 && (
        <div className="card">
          <h3>Topics to revisit</h3>
          <div className="row">
            {result.weakTopics.map((t) => <Badge key={t} tone="warning">{t}</Badge>)}
          </div>
          {result.roadmap && <p className="small muted">Open your roadmap and revise these steps, then try another practice round to see your score improve.</p>}
          <Button to="/app/roadmap" size="sm">Go to my roadmap</Button>
        </div>
      )}
    </div>
  );
}

/** Timed test: server-owned deadline, autosave, question navigator, auto-submit at zero. */
function Taker({ data, attemptId }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { questions, test } = data;
  const [answers, setAnswers] = useState(data.answers || {});
  const [current, setCurrent] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const dirty = useRef({});
  const submitted = useRef(false);

  // Clock offset: trust the server's "now" so a wrong laptop clock cannot extend the test.
  const offset = useMemo(() => new Date(data.serverNow).getTime() - Date.now(), [data.serverNow]);
  const deadline = new Date(data.attempt.deadline).getTime();
  const [left, setLeft] = useState(() => (deadline - (Date.now() + offset)) / 1000);

  const finish = useMutation({
    mutationFn: () => testApi.submit(attemptId, answers),
    onSuccess: () => {
      submitted.current = true;
      qc.invalidateQueries({ queryKey: ['student-tests'] });
      qc.invalidateQueries({ queryKey: ['test-results-me'] });
      qc.invalidateQueries({ queryKey: ['attempt', attemptId] });
      navigate(`/app/tests/attempt/${attemptId}`, { replace: true });
      toast.success('Test submitted.');
    },
    onError: (err) => {
      setConfirm(false);
      toast.error(getErrorMessage(err));
    },
  });

  useEffect(() => {
    const t = setInterval(() => setLeft((deadline - (Date.now() + offset)) / 1000), 1000);
    return () => clearInterval(t);
  }, [deadline, offset]);

  useEffect(() => {
    if (left <= 0 && !submitted.current && !finish.isPending) finish.mutate();
  }, [left, finish]);

  // Autosave: batch changes for 1.2s so a refresh or dropped connection loses nothing.
  const flush = useCallback(async () => {
    const batch = dirty.current;
    if (!Object.keys(batch).length) return;
    dirty.current = {};
    setSaveState('saving');
    try {
      await testApi.saveAnswers(attemptId, batch);
      setSaveState(Object.keys(dirty.current).length ? 'saving' : 'saved');
    } catch {
      dirty.current = { ...batch, ...dirty.current };
      setSaveState('error');
    }
  }, [attemptId]);

  useEffect(() => {
    const t = setInterval(flush, 1200);
    return () => clearInterval(t);
  }, [flush]);

  useEffect(() => {
    const warn = (e) => {
      if (!submitted.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const choose = (qid, i) => {
    setAnswers((a) => ({ ...a, [qid]: i }));
    dirty.current[qid] = i;
    setSaveState('saving');
  };

  const q = questions[current];
  const answered = questions.filter((x) => answers[x._id] !== undefined && answers[x._id] !== null).length;
  const low = left < 300;

  return (
    <>
      <div className="card row-between" style={{ position: 'sticky', top: 8, zIndex: 5 }}>
        <div>
          <strong>{test.title}</strong>
          <div className="xs muted">
            {answered}/{questions.length} answered · {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Offline — will retry' : 'All changes saved'}
          </div>
        </div>
        <div className="row">
          <span className="test-timer row" data-low={low} aria-live={low ? 'polite' : 'off'} style={{ '--gap': '6px' }}>
            <Clock size={18} aria-hidden="true" /> {mmss(left)}
          </span>
          <Button variant="primary" icon={Check} onClick={() => setConfirm(true)}>Submit</Button>
        </div>
      </div>

      {test.instructions && current === 0 && <Alert type="info" className="mt-0">{test.instructions}</Alert>}

      <div className="test-layout" style={{ marginTop: 16 }}>
        <div className="card stack">
          <div className="row-between">
            <span className="small muted">Question {current + 1} of {questions.length}</span>
            {q.topic && <Badge>{q.topic}</Badge>}
          </div>
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{q.text}</h2>
          <Choices options={q.options} value={answers[q._id] ?? undefined} onChange={(i) => choose(q._id, i)} />
          <div className="row-between">
            <Button icon={ArrowLeft} disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>Previous</Button>
            {answers[q._id] !== undefined && <Button variant="ghost" size="sm" onClick={() => { setAnswers((a) => { const n = { ...a }; delete n[q._id]; return n; }); dirty.current[q._id] = null; }}>Clear answer</Button>}
            <Button iconRight={ArrowRight} variant={current === questions.length - 1 ? 'default' : 'primary'} disabled={current === questions.length - 1} onClick={() => setCurrent((c) => c + 1)}>Next</Button>
          </div>
        </div>
        <aside className="card stack" style={{ '--gap': '10px' }} aria-label="Question navigator">
          <strong className="small">Questions</strong>
          <div className="qnav">
            {questions.map((x, i) => (
              <button key={x._id} type="button" data-answered={answers[x._id] !== undefined && answers[x._id] !== null} aria-current={i === current} aria-label={`Question ${i + 1}${answers[x._id] !== undefined ? ', answered' : ''}`} onClick={() => setCurrent(i)}>{i + 1}</button>
            ))}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => finish.mutate()}
        loading={finish.isPending}
        title="Submit your test?"
        confirmLabel="Submit now"
        message={answered < questions.length ? `You have answered ${answered} of ${questions.length} questions. Unanswered questions score zero. You cannot change answers after submitting.` : 'You cannot change your answers after submitting.'}
      />
    </>
  );
}

/** One route for both states: in-progress → taker, submitted → result. */
export function TestAttempt() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['attempt', id], queryFn: () => testApi.attempt(id), staleTime: 0, gcTime: 0 });
  if (isLoading) return <CardSkeleton count={2} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  if (d.inProgress) return <Taker data={d} attemptId={id} />;
  return (
    <>
      <PageTitle title="Test result" subtitle="Well done for finishing. Use the review to learn from mistakes." />
      <ResultView result={d} back="/app/tests?tab=results" backLabel="All results" />
    </>
  );
}

/** Practice runner: quiz (multiple choice) or confidence check (rate yourself 1–5). */
export function PracticeRun() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['practice', id], queryFn: () => practiceApi.get(id), staleTime: 0 });
  const [answers, setAnswers] = useState({});
  const submit = useMutation({
    mutationFn: (count) => practiceApi.submit(id, Array.from({ length: count }, (_, i) => answers[i] ?? null)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', id] });
      qc.invalidateQueries({ queryKey: ['practice-history'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  if (isLoading) return <CardSkeleton count={2} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  if (d.status === 'submitted') {
    return (
      <>
        <PageTitle title="Practice result" />
        <ResultView result={{ ...d, reviewAvailable: true }} back="/app/tests?tab=practice" backLabel="Back to practice" />
      </>
    );
  }
  const conf = d.kind === 'confidence';
  return (
    <>
      <PageTitle title={d.title} subtitle={conf ? 'Rate how confident you feel about each step: 1 = not started, 5 = could teach it.' : 'Pick the best answer. Nothing here affects your grades — it is only for you.'} />
      <div className="stack">
        {d.questions.map((q, i) => (
          <div key={i} className="card stack" style={{ '--gap': '10px' }}>
            <strong>{i + 1}. {q.text}</strong>
            {conf ? (
              <div className="rating" role="group" aria-label={`Confidence for ${q.text}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={answers[i] === n} onClick={() => setAnswers((a) => ({ ...a, [i]: n }))}>{n}</button>
                ))}
              </div>
            ) : (
              <Choices options={q.options} value={answers[i]} onChange={(c) => setAnswers((a) => ({ ...a, [i]: c }))} />
            )}
          </div>
        ))}
        <div className="row">
          <Button to="/app/tests?tab=practice">Cancel</Button>
          <Button variant="primary" loading={submit.isPending} onClick={() => submit.mutate(d.questions.length)}>See my result</Button>
          <span className="small muted">{Object.keys(answers).length}/{d.questions.length} answered</span>
        </div>
      </div>
    </>
  );
}
