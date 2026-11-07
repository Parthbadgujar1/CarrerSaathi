import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Compass, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { roadmapApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { Alert, Badge, Button, CardSkeleton, ErrorState, ProgressBar } from '../ui';
import { RoadmapCard } from './RoadmapParts';

/**
 * Career Compass — a fresh, AI-written interest quiz on every attempt (with a standard question
 * set as fallback). Each question allows several answers; the picks vote for matching roadmaps.
 */
export function CareerQuiz({ enrolledIds }) {
  const qc = useQueryClient();
  const [round, setRound] = useState(0); // bump to ask the AI for a brand-new quiz
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['quiz', round],
    queryFn: roadmapApi.generateQuiz,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState({}); // { [questionId]: optionId[] }
  const recommend = useMutation({ mutationFn: (selections) => roadmapApi.recommend({ selections }), onError: (err) => toast.error(getErrorMessage(err)) });
  const enroll = useMutation({
    mutationFn: (id) => roadmapApi.enroll(id),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const restart = (newQuestions) => {
    recommend.reset();
    setPicked({});
    setStep(0);
    if (newQuestions) setRound((r) => r + 1);
  };

  if (isLoading || (isFetching && !data)) {
    return (
      <div className="stack" style={{ maxWidth: 720 }}>
        <CardSkeleton lines={5} />
        <p className="small muted center mb-0" role="status">Saathi is writing a fresh set of questions for you…</p>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { questions, source, notice } = data.data;

  if (recommend.data) {
    return (
      <div className="stack">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Your top matches</h2>
            <p className="small muted mb-0">Based on your interests and degree. Try one for two weeks before committing.</p>
          </div>
          <div className="row" style={{ '--gap': '8px' }}>
            <Button icon={RotateCcw} onClick={() => restart(false)}>
              Retake quiz
            </Button>
            <Button icon={RefreshCw} onClick={() => restart(true)}>
              New questions
            </Button>
          </div>
        </div>
        <div className="grid-3">
          {recommend.data.data.map((m, i) => (
            <RoadmapCard
              key={m.slug}
              roadmap={m.roadmap}
              to={`/app/roadmap/${m.slug}`}
              footer={
                <div className="stack" style={{ '--gap': '8px' }}>
                  <p className="xs muted mb-0">
                    <strong>#{i + 1} match</strong> — you chose: {m.reasons.join(', ')}
                  </p>
                  {enrolledIds?.has(m.roadmap._id) ? (
                    <span className="badge badge-success" style={{ alignSelf: 'flex-start' }}>Following</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={enroll.isPending && enroll.variables === m.roadmap._id}
                      onClick={(e) => {
                        e.preventDefault();
                        enroll.mutate(m.roadmap._id);
                      }}
                    >
                      Follow roadmap
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </div>
      </div>
    );
  }

  const q = questions[step];
  const chosen = picked[q.id] || [];
  const last = step === questions.length - 1;
  const toggle = (id) => setPicked((p) => ({ ...p, [q.id]: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] }));
  const submit = () =>
    recommend.mutate(
      questions.flatMap((qq) => qq.options.filter((o) => (picked[qq.id] || []).includes(o.id)).map((o) => ({ label: o.label, slugs: o.slugs }))),
    );

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="row-between mb-1">
        <span className="row small bold" style={{ '--gap': '6px' }}>
          <Compass size={16} aria-hidden="true" /> Career Compass
          {source === 'ai' && <Badge icon={Sparkles} tone="accent">AI-generated</Badge>}
        </span>
        <span className="xs muted">
          Question {step + 1} of {questions.length}
        </span>
      </div>
      {notice && <Alert type="info" className="mb-1">{notice}</Alert>}
      <ProgressBar value={((step + (chosen.length ? 1 : 0)) / questions.length) * 100} small label="Quiz progress" />
      <fieldset style={{ border: 0, padding: 0, margin: '20px 0 0' }}>
        <legend style={{ fontSize: '1.1rem', fontWeight: 650, marginBottom: 4 }}>{q.question}</legend>
        <p className="xs muted" style={{ marginBottom: 12 }}>Select all that apply.</p>
        <div className="stack" style={{ '--gap': '8px' }}>
          {q.options.map((o) => {
            const on = chosen.includes(o.id);
            return (
              <label key={o.id} className="step-item" style={{ cursor: 'pointer', alignItems: 'center', borderColor: on ? 'var(--primary)' : undefined, background: on ? 'var(--primary-soft)' : undefined }}>
                <input type="checkbox" checked={on} onChange={() => toggle(o.id)} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="row-between mt-3">
        <Button icon={ArrowLeft} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {last ? (
          <Button variant="primary" disabled={!chosen.length} loading={recommend.isPending} onClick={submit}>
            See my matches
          </Button>
        ) : (
          <Button variant="primary" iconRight={ArrowRight} disabled={!chosen.length} onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
