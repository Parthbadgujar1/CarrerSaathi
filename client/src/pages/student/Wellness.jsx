import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Droplets, Dumbbell, Flame, HeartPulse, Lock, Moon, Pause, Phone, Play, RotateCcw, Smile, Timer, Wind } from 'lucide-react';
import { userApi, wellnessApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { getErrorMessage } from '../../lib/http';
import { PageTitle } from '../../components/common/PageTitle';
import { Alert, Button, CardSkeleton, ErrorState, Switch, TextAreaField, TextField, StatCard } from '../../components/ui';
import { ChartCard, ColumnChart, LineChart } from '../../components/charts/Charts';

export const MOODS = [
  { value: 1, emoji: '😞', label: 'Low' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

const dayLabel = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d));
  }
  return out;
}

function CheckinForm({ today }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    mood: today?.mood || 0,
    stress: today?.stress || 3,
    sleepHours: today?.sleepHours ?? '',
    exerciseMinutes: today?.exerciseMinutes ?? '',
    waterGlasses: today?.waterGlasses ?? '',
    screenHours: today?.screenHours ?? '',
    journal: today?.journal || '',
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { mood: form.mood, stress: Number(form.stress), journal: form.journal };
      for (const k of ['sleepHours', 'exerciseMinutes', 'waterGlasses', 'screenHours']) if (form[k] !== '') body[k] = Number(form[k]);
      return wellnessApi.checkin(body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['wellness'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="card-header" style={{ marginBottom: 0 }}>
        <h2>Today's check-in</h2>
        {today && <span className="badge badge-success">Saved today</span>}
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label mb-1">How's your mood?</legend>
        <div className="mood-picker">
          {MOODS.map((m) => (
            <button key={m.value} type="button" className="mood-btn" aria-pressed={form.mood === m.value} onClick={() => set('mood', m.value)}>
              <span className="emoji" aria-hidden="true">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="stress" className="label">Stress level: {['', 'Very low', 'Low', 'Moderate', 'High', 'Very high'][form.stress]}</label>
        <input id="stress" type="range" min="1" max="5" value={form.stress} onChange={(e) => set('stress', Number(e.target.value))} style={{ accentColor: 'var(--primary)' }} />
      </div>
      <div className="form-grid">
        <TextField label="Sleep (hours)" type="number" min="0" max="24" step="0.5" icon={Moon} value={form.sleepHours} onChange={(e) => set('sleepHours', e.target.value)} />
        <TextField label="Exercise (min)" type="number" min="0" max="600" icon={Dumbbell} value={form.exerciseMinutes} onChange={(e) => set('exerciseMinutes', e.target.value)} />
        <TextField label="Water (glasses)" type="number" min="0" max="30" icon={Droplets} value={form.waterGlasses} onChange={(e) => set('waterGlasses', e.target.value)} />
        <TextField label="Screen time (hours)" type="number" min="0" max="24" step="0.5" value={form.screenHours} onChange={(e) => set('screenHours', e.target.value)} />
      </div>
      <TextAreaField
        label={
          <span className="row" style={{ '--gap': '6px' }}>
            <Lock size={13} aria-hidden="true" /> Private journal
          </span>
        }
        hint="Encrypted and visible only to you"
        rows={3}
        maxLength={2000}
        value={form.journal}
        onChange={(e) => set('journal', e.target.value)}
        placeholder="One thing that went well today…"
      />
      <div>
        <Button type="submit" variant="primary" disabled={!form.mood} loading={save.isPending}>
          {today ? 'Update check-in' : 'Save check-in'}
        </Button>
      </div>
    </form>
  );
}

const PHASES = [
  { label: 'Breathe in', secs: 4, scale: 1.25 },
  { label: 'Hold', secs: 4, scale: 1.25 },
  { label: 'Breathe out', secs: 4, scale: 0.85 },
  { label: 'Hold', secs: 4, scale: 0.85 },
];
function BreathingExercise() {
  const [running, setRunning] = useState(false);
  const [{ phase, count }, setState] = useState({ phase: 0, count: PHASES[0].secs });
  useEffect(() => {
    if (!running) return undefined;
    // Pure updater (safe under StrictMode double-invocation).
    const t = setInterval(() => {
      setState((s) => (s.count > 1 ? { ...s, count: s.count - 1 } : { phase: (s.phase + 1) % PHASES.length, count: PHASES[(s.phase + 1) % PHASES.length].secs }));
    }, 1000);
    return () => clearInterval(t);
  }, [running]);
  const p = PHASES[phase];
  return (
    <section className="card center" aria-labelledby="breath-h">
      <h2 id="breath-h" className="row" style={{ justifyContent: 'center', '--gap': '8px', fontSize: '1rem' }}>
        <Wind size={17} aria-hidden="true" /> Box breathing
      </h2>
      <p className="small muted">4 seconds in · hold · out · hold. Two minutes calms the nervous system.</p>
      <div className="breath-circle" style={{ transform: `scale(${running ? p.scale : 1})` }} aria-live="polite">
        {running ? (
          <span>
            {p.label}
            <br />
            <span style={{ fontSize: '1.4rem' }}>{count}</span>
          </span>
        ) : (
          'Ready'
        )}
      </div>
      <Button
        icon={running ? Pause : Play}
        onClick={() => {
          setRunning((r) => !r);
          setState({ phase: 0, count: PHASES[0].secs });
        }}
      >
        {running ? 'Stop' : 'Start'}
      </Button>
    </section>
  );
}

function FocusTimer() {
  const [mode, setMode] = useState('focus');
  const total = mode === 'focus' ? 25 * 60 : 5 * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!running) return undefined;
    ref.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(ref.current);
  }, [running]);
  useEffect(() => {
    if (left === 0 && running) {
      setRunning(false);
      toast.success(mode === 'focus' ? 'Focus session done! Take a 5-minute break 🌿' : 'Break over — ready for another session?');
      const next = mode === 'focus' ? 'break' : 'focus';
      setMode(next);
      setLeft(next === 'focus' ? 25 * 60 : 5 * 60);
    }
  }, [left, running, mode]);
  useEffect(() => {
    document.title = running ? `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')} · Focus` : 'Wellness · CareerSaathi';
  }, [left, running]);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <section className="card center" aria-labelledby="focus-h">
      <h2 id="focus-h" className="row" style={{ justifyContent: 'center', '--gap': '8px', fontSize: '1rem' }}>
        <Timer size={17} aria-hidden="true" /> Focus timer
      </h2>
      <div className="segmented" role="group" aria-label="Timer mode">
        {['focus', 'break'].map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => (setMode(m), setRunning(false), setLeft(m === 'focus' ? 1500 : 300))}>
            {m === 'focus' ? 'Focus 25' : 'Break 5'}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.03em', margin: '14px 0', fontVariantNumeric: 'tabular-nums' }} role="timer" aria-live="off">
        {mm}:{ss}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Button variant="primary" icon={running ? Pause : Play} onClick={() => setRunning((r) => !r)}>
          {running ? 'Pause' : 'Start'}
        </Button>
        <Button icon={RotateCcw} onClick={() => (setRunning(false), setLeft(total))}>Reset</Button>
      </div>
    </section>
  );
}

export function Wellness() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [days, setDays] = useState(14);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['wellness', days], queryFn: () => wellnessApi.history(days) });
  const { data: resources } = useQuery({ queryKey: ['wellness-resources'], queryFn: wellnessApi.resources, staleTime: Infinity });
  const share = useMutation({
    mutationFn: (v) => userApi.updatePreferences({ wellnessShareWithMentor: v }),
    onSuccess: (res) => {
      setUser(res.data.user);
      toast.success('Sharing preference updated.');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const header = <PageTitle title="Wellness" subtitle="Small daily habits for a healthy mind and body — private to you." />;
  if (isLoading) return <>{header}<div className="grid-2"><CardSkeleton lines={6} /><CardSkeleton lines={6} /></div></>;
  if (error) return <>{header}<ErrorState error={error} onRetry={refetch} /></>;

  const w = data.data;
  const byDay = new Map(w.logs.map((l) => [l.day, l]));
  const series = lastNDays(days).map((d) => ({ label: dayLabel(d), short: dayLabel(d), mood: byDay.get(d)?.mood ?? null, sleep: byDay.get(d)?.sleepHours ?? 0 }));
  const moodLabel = (v) => (v ? `${MOODS[v - 1]?.emoji} ${MOODS[v - 1]?.label}` : 'No check-in');

  return (
    <>
      {header}
      {w.supportNudge && (
        <Alert type="warning" title="It looks like the last few days have been tough" className="mb-2">
          You don't have to handle it alone. Talk to someone you trust or your mentor — and Tele-MANAS offers free, confidential support 24×7 at{' '}
          <a href="tel:14416">14416</a>.
        </Alert>
      )}
      <div className="grid-4 mb-2">
        <StatCard icon={Flame} label="Check-in streak" value={`${w.stats.streak} day${w.stats.streak === 1 ? '' : 's'}`} tone="warning" />
        <StatCard icon={Smile} label={`Average mood (${days}d)`} value={w.stats.avgMood ? `${w.stats.avgMood} / 5` : '—'} />
        <StatCard icon={Moon} label="Average sleep" value={w.stats.avgSleep ? `${w.stats.avgSleep} h` : '—'} tone="info" />
        <StatCard icon={Dumbbell} label="Average exercise" value={w.stats.avgExercise ? `${w.stats.avgExercise} min` : '—'} tone="success" />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <CheckinForm key={w.today?.updatedAt || 'new'} today={w.today} />
        <div className="stack">
          <div className="segmented" role="group" aria-label="Chart range" style={{ alignSelf: 'flex-start' }}>
            {[14, 30].map((n) => (
              <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)}>
                Last {n} days
              </button>
            ))}
          </div>
          <ChartCard title="Mood" subtitle="1 = low · 5 = great" rows={series.map((s) => ({ label: s.label, value: s.mood ?? '—', display: moodLabel(s.mood) }))} columns={['Day', 'Mood']}>
            <LineChart data={series.map((s) => ({ label: s.label, short: s.short, value: s.mood }))} yMin={1} yMax={5} yTicks={[1, 3, 5]} valueLabel={moodLabel} ariaLabel={`Mood over the last ${days} days`} />
          </ChartCard>
          <ChartCard title="Sleep" subtitle="Hours per night (aim for 7–8)" rows={series.map((s) => ({ label: s.label, value: s.sleep, display: s.sleep ? `${s.sleep} h` : '—' }))} columns={['Day', 'Sleep']}>
            <ColumnChart data={series.map((s) => ({ label: s.label, short: s.short, value: s.sleep }))} height={170} tickEvery={days > 14 ? 7 : 3} valueLabel={(v) => (v ? `${v} hours` : 'Not logged')} ariaLabel={`Sleep hours over the last ${days} days`} />
          </ChartCard>
        </div>
      </div>

      {/* Two similar-height tools side by side, then support as its own full-width card. */}
      <div className="grid-2 mt-2 wellness-tools">
        <BreathingExercise />
        <FocusTimer />
      </div>
      <section className="card mt-2" aria-labelledby="support-h">
        <div className="card-header">
          <h2 id="support-h" className="row" style={{ '--gap': '8px' }}>
            <HeartPulse size={17} aria-hidden="true" /> Support & tips
          </h2>
        </div>
        <div className="grid-3 grid-top">
          <div>
            <h3 className="xs subtle mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Talk to someone</h3>
            <ul className="list-plain stack" style={{ '--gap': '10px' }}>
              {(resources?.data?.helplines || []).map((h) => (
                <li key={h.name} className="row small" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <Phone size={15} aria-hidden="true" style={{ marginTop: 3, flexShrink: 0 }} />
                  <span>
                    <strong>{h.name}</strong>: <a href={`tel:${h.contact.split(' ')[0]}`}>{h.contact}</a>
                    <br />
                    <span className="xs muted">{h.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="xs subtle mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Healthy habits</h3>
            <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
              {(resources?.data?.tips || []).slice(0, 4).map((t) => (
                <li key={t} style={{ marginBottom: 6 }}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="xs subtle mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your privacy</h3>
            <Switch
              label="Share a wellness summary with my mentor"
              description="Only averages (mood, stress, sleep) — never your journal."
              checked={Boolean(user.consents?.wellnessShareWithMentor)}
              onChange={(v) => share.mutate(v)}
              disabled={share.isPending}
            />
          </div>
        </div>
      </section>
      <p className="xs subtle mt-2">CareerSaathi's wellbeing tools support healthy habits; they are not a substitute for professional care.</p>
    </>
  );
}
