import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Archive, BarChart3, Copy, Download, FileSpreadsheet, Pencil, Plus, Send, Sparkles, Trash2, Upload, Users } from 'lucide-react';
import { adminTestApi, downloadBlob } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { fmtDateTime, toLocalInput } from '../../lib/format';
import { PageTitle } from '../../components/common/PageTitle';
import { Alert, Badge, Button, CardSkeleton, ChipsField, ConfirmDialog, EmptyState, ErrorState, Modal, SelectField, StatCard, Tabs, TextAreaField, TextField } from '../../components/ui';
import { BarList } from '../../components/charts/Charts';

const STATE_TONE = { open: 'success', upcoming: 'info', closed: '' };
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

const blankQuestion = () => ({ text: '', options: ['', '', '', ''], correct: 0, explanation: '', topic: '', marks: 1 });

function QuestionEditor({ q, index, onChange, onRemove, locked }) {
  const [open, setOpen] = useState(!q.text);
  const set = (patch) => onChange({ ...q, ...patch });
  const setOption = (i, v) => set({ options: q.options.map((o, j) => (j === i ? v : o)) });
  return (
    <div className="card stack" style={{ '--gap': '10px', padding: 12 }}>
      <div className="row-between">
        <button type="button" className="btn btn-ghost" style={{ textAlign: 'left', flex: 1, justifyContent: 'flex-start' }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <strong>{index + 1}.</strong>&nbsp;{q.text || <em className="muted">New question</em>}
        </button>
        <div className="row">
          {q.topic && <Badge>{q.topic}</Badge>}
          <Badge tone="primary">Answer {KEYS[q.correct]}</Badge>
          {!locked && <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove question ${index + 1}`} onClick={onRemove} />}
        </div>
      </div>
      {open && (
        <div className="stack" style={{ '--gap': '10px' }}>
          <TextAreaField label="Question" value={q.text} onChange={(e) => set({ text: e.target.value })} maxLength={1000} rows={2} disabled={locked} />
          <div className="grid-2">
            {q.options.map((o, i) => (
              <div key={i} className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' }}>
                <input type="radio" name={`correct-${index}`} checked={q.correct === i} onChange={() => set({ correct: i })} aria-label={`Option ${KEYS[i]} is correct`} disabled={locked} />
                <TextField className="flex-1" aria-label={`Option ${KEYS[i]}`} placeholder={`Option ${KEYS[i]}`} value={o} onChange={(e) => setOption(i, e.target.value)} maxLength={400} disabled={locked} />
              </div>
            ))}
          </div>
          <p className="xs muted mb-0">Select the radio button beside the correct option.</p>
          <div className="grid-3">
            <TextField label="Topic (optional)" value={q.topic} onChange={(e) => set({ topic: e.target.value })} maxLength={120} />
            <TextField label="Marks" type="number" min="0.25" max="20" step="0.25" value={q.marks} onChange={(e) => set({ marks: e.target.value })} />
          </div>
          <TextAreaField label="Explanation (optional, shown in review)" value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} rows={2} maxLength={1000} />
        </div>
      )}
    </div>
  );
}

function ExcelUpload({ onAdd }) {
  const input = useRef(null);
  const [result, setResult] = useState(null);
  const parse = useMutation({
    mutationFn: (file) => adminTestApi.parseExcel(file),
    onSuccess: (res) => setResult(res.data),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const template = useMutation({
    mutationFn: adminTestApi.template,
    onSuccess: (res) => downloadBlob(res, 'careersaathi-test-template.xlsx'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  return (
    <div className="stack">
      <Alert type="info" title="How it works">
        Download the template, add one question per row (Question, Options A–D, Correct letter), then upload it. You will see a preview and any row errors before anything is added.
      </Alert>
      <div className="row">
        <Button icon={Download} loading={template.isPending} onClick={() => template.mutate()}>Download Excel template</Button>
        <Button variant="primary" icon={Upload} loading={parse.isPending} onClick={() => input.current?.click()}>Upload filled file (.xlsx / .csv)</Button>
        <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) parse.mutate(f); }} />
      </div>
      {result && (
        <div className="stack" style={{ '--gap': '10px' }}>
          <div className="row">
            <Badge tone={result.questions.length ? 'success' : 'danger'}>{result.questions.length} question{result.questions.length === 1 ? '' : 's'} ready</Badge>
            {result.errors.length > 0 && <Badge tone="warning">{result.errors.length} row problem{result.errors.length === 1 ? '' : 's'}</Badge>}
          </div>
          {result.errors.length > 0 && (
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {result.errors.slice(0, 12).map((e, i) => <li key={i}>{e.row ? `Row ${e.row}: ` : ''}{e.message}</li>)}
            </ul>
          )}
          {result.questions.length > 0 && (
            <>
              <ol className="small" style={{ margin: 0, paddingLeft: 20, maxHeight: 180, overflow: 'auto' }}>
                {result.questions.slice(0, 50).map((q, i) => <li key={i}>{q.text}</li>)}
              </ol>
              <div><Button variant="primary" onClick={() => { onAdd(result.questions, 'excel'); setResult(null); }}>Add {result.questions.length} questions to this test</Button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AiGenerate({ onAdd, defaultTopic }) {
  const [form, setForm] = useState({ topic: defaultTopic || '', count: '10', difficulty: 'medium', context: '', instructions: '' });
  const [out, setOut] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const gen = useMutation({
    mutationFn: () => adminTestApi.generateQuestions({ ...form, count: Number(form.count) }),
    onSuccess: (res) => setOut(res.data),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  return (
    <div className="stack">
      <p className="small muted mb-0">Describe the topic and the AI drafts questions. Review them before adding — you can edit or remove any question afterwards. Uses every API key added in Admin → System, rotating automatically.</p>
      <TextField label="Topic" required value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Operating systems: process scheduling and deadlocks" maxLength={160} />
      <div className="grid-3">
        <SelectField label="Questions" value={form.count} onChange={(e) => set('count', e.target.value)} options={['5', '10', '15', '20', '30', '40']} />
        <SelectField label="Difficulty" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)} options={['easy', 'medium', 'hard']} />
        <TextField label="Audience (optional)" value={form.context} onChange={(e) => set('context', e.target.value)} placeholder="2nd-year B.Tech CSE" maxLength={200} />
      </div>
      <TextAreaField label="Extra instructions (optional)" value={form.instructions} onChange={(e) => set('instructions', e.target.value)} rows={2} maxLength={500} placeholder="Focus on practical scenarios; avoid trick questions…" />
      <div><Button variant="primary" icon={Sparkles} loading={gen.isPending} disabled={form.topic.trim().length < 3} onClick={() => gen.mutate()}>Generate questions</Button></div>
      {out && (
        <div className="stack" style={{ '--gap': '10px' }}>
          <Badge tone="success">{out.questions.length} questions drafted{out.provider ? ` by ${out.provider}` : ''}</Badge>
          <ol className="small" style={{ margin: 0, paddingLeft: 20, maxHeight: 200, overflow: 'auto' }}>
            {out.questions.map((q, i) => <li key={i}>{q.text}</li>)}
          </ol>
          <div className="row">
            <Button variant="primary" onClick={() => { onAdd(out.questions, 'ai'); setOut(null); }}>Add to this test</Button>
            <Button loading={gen.isPending} onClick={() => gen.mutate()}>Regenerate</Button>
          </div>
        </div>
      )}
    </div>
  );
}

const asNums = (arr) => arr.map(Number).filter((n) => Number.isFinite(n));

function TestBuilder({ initial, onClose }) {
  const qc = useQueryClient();
  const locked = Boolean(initial?.hasAttempts);
  const defaultStart = new Date(Date.now() + 86_400_000);
  defaultStart.setHours(10, 0, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 24 * 3600_000);
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    instructions: initial?.instructions || '',
    startAt: toLocalInput(initial?.startAt || defaultStart),
    endAt: toLocalInput(initial?.endAt || defaultEnd),
    durationMinutes: String(initial?.durationMinutes || 30),
    passPercent: String(initial?.passPercent ?? 40),
    maxAttempts: String(initial?.maxAttempts || 1),
    shuffleQuestions: initial?.shuffleQuestions ?? true,
    showResults: initial?.showResults || 'immediate',
  });
  const [aud, setAud] = useState({
    degrees: initial?.audience?.degrees || [],
    graduationYears: (initial?.audience?.graduationYears || []).map(String),
    currentYears: (initial?.audience?.currentYears || []).map(String),
    colleges: initial?.audience?.colleges || [],
    tracks: initial?.audience?.tracks || [],
  });
  const [questions, setQuestions] = useState(() => (initial?.questions || []).map((q) => ({ ...q })));
  const [source, setSource] = useState(initial?.source || 'manual');
  const [addTab, setAddTab] = useState('excel');
  const [errors, setErrors] = useState({});

  const options = useQuery({ queryKey: ['test-audience-options'], queryFn: adminTestApi.audienceOptions, staleTime: 60_000 });
  const audience = { degrees: aud.degrees, colleges: aud.colleges, tracks: aud.tracks, graduationYears: asNums(aud.graduationYears), currentYears: asNums(aud.currentYears) };
  const count = useQuery({ queryKey: ['test-audience-count', audience], queryFn: () => adminTestApi.audiencePreview(audience), placeholderData: (p) => p });
  const opt = options.data?.data;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addQuestions = (list, from) => {
    setQuestions((qs) => [...qs, ...list.map((q) => ({ ...q }))]);
    setSource((s) => (s === 'manual' || s === from ? from : 'mixed'));
    toast.success(`${list.length} question${list.length === 1 ? '' : 's'} added.`);
  };

  const save = useMutation({
    mutationFn: (status) => {
      const body = {
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        passPercent: Number(form.passPercent),
        maxAttempts: Number(form.maxAttempts),
        source,
        audience,
        status,
        questions: questions.map((q) => ({ text: q.text.trim(), options: q.options.map((o) => o.trim()).filter(Boolean), correct: q.correct, explanation: q.explanation || '', topic: q.topic || '', marks: Number(q.marks) || 1 })),
      };
      return initial ? adminTestApi.update(initial._id, body) : adminTestApi.create(body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['admin-tests'] });
      onClose();
    },
    onError: (err) => {
      const details = err.response?.data?.error?.details || [];
      setErrors(Object.fromEntries(details.map((d) => [d.field, d.message])));
      toast.error(getErrorMessage(err));
    },
  });

  const questionsOk = questions.length > 0 && questions.every((q) => q.text.trim().length >= 5 && q.options.filter((o) => o.trim()).length >= 2 && q.options[q.correct]?.trim());
  const valid = form.title.trim().length >= 3 && form.startAt && form.endAt && new Date(form.endAt) > new Date(form.startAt);
  const published = initial?.status === 'published';

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={initial ? `Edit test: ${initial.title}` : 'New test'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <span className="flex-1" />
          {!published && <Button loading={save.isPending && save.variables === 'draft'} disabled={!valid} onClick={() => save.mutate('draft')}>Save draft</Button>}
          <Button variant="primary" icon={Send} loading={save.isPending && save.variables === 'published'} disabled={!valid || !questionsOk} onClick={() => save.mutate('published')}>
            {published ? 'Save changes' : 'Publish & notify students'}
          </Button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '22px' }}>
        {locked && <Alert type="warning" title="Students have already attempted this test">Questions are locked to keep scores fair. You can still change the title, schedule, and audience.</Alert>}

        <section className="stack" style={{ '--gap': '12px' }}>
          <h3 className="mb-0">1. Details & schedule</h3>
          <TextField label="Test title" required value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} maxLength={140} placeholder="Mid-term assessment: Data Structures" />
          <TextAreaField label="Description (optional)" value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} maxLength={600} />
          <TextAreaField label="Instructions shown before starting (optional)" value={form.instructions} onChange={(e) => set('instructions', e.target.value)} rows={2} maxLength={1000} />
          <div className="grid-2">
            <TextField label="Opens at" type="datetime-local" required value={form.startAt} onChange={(e) => set('startAt', e.target.value)} hint="Indian Standard Time" />
            <TextField label="Closes at" type="datetime-local" required value={form.endAt} onChange={(e) => set('endAt', e.target.value)} error={form.endAt && new Date(form.endAt) <= new Date(form.startAt) ? 'Must be after the opening time' : errors.endAt} />
          </div>
          <div className="grid-3">
            <TextField label="Duration (minutes)" type="number" min="5" max="360" value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} hint="Per attempt, from when the student starts" />
            <TextField label="Pass mark (%)" type="number" min="0" max="100" value={form.passPercent} onChange={(e) => set('passPercent', e.target.value)} />
            <TextField label="Attempts allowed" type="number" min="1" max="10" value={form.maxAttempts} onChange={(e) => set('maxAttempts', e.target.value)} />
          </div>
          <div className="grid-2">
            <SelectField label="Show answers to students" value={form.showResults} onChange={(e) => set('showResults', e.target.value)} options={[{ value: 'immediate', label: 'Right after they submit' }, { value: 'after-end', label: 'After the test closes' }, { value: 'never', label: 'Never (score only)' }]} />
            <SelectField label="Question order" value={String(form.shuffleQuestions)} onChange={(e) => set('shuffleQuestions', e.target.value === 'true')} options={[{ value: 'true', label: 'Shuffled for every student' }, { value: 'false', label: 'Same order for everyone' }]} />
          </div>
        </section>

        <section className="stack" style={{ '--gap': '12px' }}>
          <div className="row-between">
            <h3 className="mb-0">2. Who gets this test</h3>
            <Badge tone="primary" icon={Users}>{count.data?.data?.count ?? '…'} student{count.data?.data?.count === 1 ? '' : 's'} match</Badge>
          </div>
          <p className="small muted mb-0">Leave everything empty to assign to all active students. Filters combine: a student must match every filter you set.</p>
          <div className="grid-2">
            <ChipsField label="Degree" value={aud.degrees} onChange={(v) => setAud((a) => ({ ...a, degrees: v }))} suggestions={opt?.degrees || []} placeholder="B.Tech, MBA…" />
            <ChipsField label="Graduation year" value={aud.graduationYears} onChange={(v) => setAud((a) => ({ ...a, graduationYears: v.filter((x) => /^\d{4}$/.test(x)) }))} suggestions={(opt?.graduationYears || []).map(String)} placeholder="2027" />
            <ChipsField label="Current year of study" value={aud.currentYears} onChange={(v) => setAud((a) => ({ ...a, currentYears: v.filter((x) => /^[1-6]$/.test(x)) }))} suggestions={(opt?.currentYears || []).map(String)} placeholder="1–6" />
            <ChipsField label="College" value={aud.colleges} onChange={(v) => setAud((a) => ({ ...a, colleges: v }))} suggestions={opt?.colleges || []} />
          </div>
          <ChipsField label="Career track (roadmap slug)" value={aud.tracks} onChange={(v) => setAud((a) => ({ ...a, tracks: v }))} suggestions={(opt?.tracks || []).map((t) => t.slug)} hint="Students whose chosen tracks include any of these" />
        </section>

        <section className="stack" style={{ '--gap': '12px' }}>
          <div className="row-between">
            <h3 className="mb-0">3. Questions ({questions.length})</h3>
            {source !== 'manual' && <Badge>{source === 'excel' ? 'From Excel' : source === 'ai' ? 'AI-generated' : 'Mixed sources'}</Badge>}
          </div>
          {questions.map((q, i) => (
            <QuestionEditor key={i} q={q} index={i} locked={locked} onChange={(nq) => setQuestions((qs) => qs.map((x, j) => (j === i ? nq : x)))} onRemove={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} />
          ))}
          {!locked && (
            <div className="card stack" style={{ '--gap': '12px' }}>
              <strong>Add questions</strong>
              <Tabs value={addTab} onChange={setAddTab} label="Ways to add questions" tabs={[{ value: 'excel', label: 'Excel upload', icon: FileSpreadsheet }, { value: 'ai', label: 'Generate with AI', icon: Sparkles }, { value: 'manual', label: 'Write manually', icon: Pencil }]} />
              {addTab === 'excel' && <ExcelUpload onAdd={addQuestions} />}
              {addTab === 'ai' && <AiGenerate onAdd={addQuestions} defaultTopic={form.title} />}
              {addTab === 'manual' && <div><Button icon={Plus} onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}>Add a blank question</Button></div>}
            </div>
          )}
          {!questionsOk && questions.length > 0 && <Alert type="warning">Each question needs text, at least two options, and a filled correct option before you can publish.</Alert>}
        </section>
      </div>
    </Modal>
  );
}

function Results({ id, onClose }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-test-results', id], queryFn: () => adminTestApi.results(id) });
  const exp = useMutation({
    mutationFn: () => adminTestApi.exportResults(id),
    onSuccess: (res) => downloadBlob(res, 'test-results.xlsx'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const d = data?.data;
  return (
    <Modal open size="xl" onClose={onClose} title={d ? `Results: ${d.test.title}` : 'Results'} footer={<><Button icon={Download} loading={exp.isPending} onClick={() => exp.mutate()} disabled={!d?.attempts.length}>Export to Excel</Button><span className="flex-1" /><Button onClick={onClose}>Close</Button></>}>
      {isLoading && <CardSkeleton count={2} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {d && (
        <div className="stack">
          <div className="grid-3">
            <StatCard icon={Users} label="Attempted" value={`${d.stats.attempted} / ${d.stats.assigned}`} hint={`${d.stats.notAttempted} not yet`} />
            <StatCard icon={BarChart3} label="Average score" value={d.stats.average != null ? `${d.stats.average}%` : '—'} hint={d.stats.highest != null ? `Range ${d.stats.lowest}–${d.stats.highest}%` : 'No submissions'} />
            <StatCard icon={BarChart3} label="Pass rate" value={d.stats.passRate != null ? `${d.stats.passRate}%` : '—'} hint={`Pass mark ${d.test.passPercent}%`} />
          </div>
          {d.attempts.length === 0 ? (
            <EmptyState icon={BarChart3} title="No submissions yet">Results appear here as students finish.</EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Student</th><th>College</th><th>Score</th><th>%</th><th>Result</th><th>Time</th><th>Submitted</th></tr></thead>
                  <tbody>
                    {d.attempts.map((a) => (
                      <tr key={a._id}>
                        <td>{a.user?.name}<div className="xs muted">{a.user?.email}</div></td>
                        <td>{a.user?.education?.college || '—'}</td>
                        <td>{a.score}/{a.total}</td>
                        <td>{a.percent}%</td>
                        <td><Badge tone={a.passed ? 'success' : 'warning'}>{a.passed ? 'Passed' : 'Not passed'}</Badge>{a.autoSubmitted && <span className="xs muted"> auto</span>}</td>
                        <td>{a.timeTakenSec ? `${Math.round(a.timeTakenSec / 60)} min` : '—'}</td>
                        <td>{fmtDateTime(a.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3>Which questions were hardest</h3>
                <p className="small muted">Share of attempts that answered each question correctly. Low bars point to topics worth re-teaching.</p>
                <BarList data={d.perQuestion.map((q, i) => ({ label: `${i + 1}. ${q.text.slice(0, 70)}`, value: q.correctPercent ?? 0 }))} valueLabel={(v) => `${v}%`} ariaLabel="Correct answer rate per question" />
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export function AdminTests() {
  const qc = useQueryClient();
  const [scope, setScope] = useState('active');
  const [builder, setBuilder] = useState(null); // { initial? }
  const [resultsFor, setResultsFor] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin-tests', scope], queryFn: () => adminTestApi.list(scope === 'archived' ? { status: 'archived' } : {}) });
  const done = (res) => { toast.success(res.message || 'Done.'); qc.invalidateQueries({ queryKey: ['admin-tests'] }); };
  const fail = (err) => toast.error(getErrorMessage(err));
  const status = useMutation({ mutationFn: ({ id, s }) => adminTestApi.setStatus(id, s), onSuccess: done, onError: fail });
  const dup = useMutation({ mutationFn: adminTestApi.duplicate, onSuccess: done, onError: fail });
  const remove = useMutation({ mutationFn: adminTestApi.remove, onSuccess: (r) => { done(r); setToDelete(null); }, onError: fail });
  const openEditor = async (id) => {
    try {
      setBuilder({ initial: (await adminTestApi.get(id)).data });
    } catch (err) {
      fail(err);
    }
  };

  const tests = data?.data || [];
  return (
    <>
      <PageTitle title="Tests" subtitle="Schedule common tests, choose which students get them, and see how everyone did." actions={<Button variant="primary" icon={Plus} onClick={() => setBuilder({})}>New test</Button>} />
      <Tabs value={scope} onChange={setScope} tabs={[{ value: 'active', label: 'Drafts & live' }, { value: 'archived', label: 'Archived' }]} />
      <div style={{ marginTop: 16 }}>
        {isLoading && <CardSkeleton count={3} />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!isLoading && !error && tests.length === 0 && (
          <EmptyState icon={FileSpreadsheet} title={scope === 'archived' ? 'Nothing archived' : 'No tests yet'} action={scope === 'active' && <Button variant="primary" icon={Plus} onClick={() => setBuilder({})}>Create your first test</Button>}>
            Upload questions from Excel or let AI draft them, set a schedule, pick the degree and year, and publish.
          </EmptyState>
        )}
        <div className="stack">
          {tests.map((t) => (
            <div key={t._id} className="card stack" style={{ '--gap': '10px' }}>
              <div className="row-between">
                <h3 className="mb-0">{t.title}</h3>
                <div className="row">
                  <Badge tone={t.status === 'published' ? 'primary' : ''}>{t.status}</Badge>
                  {t.status === 'published' && <Badge tone={STATE_TONE[t.state]}>{t.state === 'open' ? 'Open now' : t.state === 'upcoming' ? 'Upcoming' : 'Closed'}</Badge>}
                </div>
              </div>
              <div className="row small muted">
                <span>{fmtDateTime(t.startAt)} → {fmtDateTime(t.endAt)}</span>
                <span>{t.questionCount} questions · {t.durationMinutes} min</span>
                <span>{t.takers} student{t.takers === 1 ? '' : 's'} attempted{t.averagePercent != null ? ` · avg ${t.averagePercent}%` : ''}</span>
              </div>
              <div className="row small muted">
                {Object.entries({ Degree: t.audience.degrees, 'Graduating': t.audience.graduationYears, 'Year': t.audience.currentYears, College: t.audience.colleges, Track: t.audience.tracks }).filter(([, v]) => v?.length).map(([k, v]) => <Badge key={k}>{k}: {v.join(', ')}</Badge>)}
                {!Object.values(t.audience).some((v) => v?.length) && <Badge>All students</Badge>}
              </div>
              <div className="row">
                <Button size="sm" icon={BarChart3} onClick={() => setResultsFor(t._id)}>Results</Button>
                <Button size="sm" icon={Pencil} onClick={() => openEditor(t._id)}>Edit</Button>
                <Button size="sm" icon={Copy} loading={dup.isPending && dup.variables === t._id} onClick={() => dup.mutate(t._id)}>Duplicate</Button>
                {t.status === 'draft' && <Button size="sm" variant="primary" icon={Send} onClick={() => status.mutate({ id: t._id, s: 'published' })}>Publish</Button>}
                {t.status === 'published' && <Button size="sm" onClick={() => status.mutate({ id: t._id, s: 'draft' })}>Unpublish</Button>}
                {t.status !== 'archived' ? <Button size="sm" icon={Archive} onClick={() => status.mutate({ id: t._id, s: 'archived' })}>Archive</Button> : <Button size="sm" onClick={() => status.mutate({ id: t._id, s: 'draft' })}>Restore</Button>}
                <Button size="sm" variant="danger" icon={Trash2} onClick={() => setToDelete(t)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {builder && <TestBuilder initial={builder.initial} onClose={() => setBuilder(null)} />}
      {resultsFor && <Results id={resultsFor} onClose={() => setResultsFor(null)} />}
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={() => remove.mutate(toDelete._id)} loading={remove.isPending} danger title="Delete this test?" confirmLabel="Delete test" message={`"${toDelete?.title}" and all ${toDelete?.attempts || 0} student attempt(s) will be permanently removed. Consider archiving instead.`} />
    </>
  );
}
