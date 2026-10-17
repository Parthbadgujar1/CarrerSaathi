import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Printer, Save, Trash2 } from 'lucide-react';
import { studentApi } from '../../services/api';
import { getErrorMessage } from '../../lib/http';
import { Alert, Button, CardSkeleton, ErrorState, IconButton, TextAreaField, TextField } from '../ui';

const EMPTY = {
  experience: { title: '', organization: '', start: '', end: '', description: '' },
  projects: { name: '', link: '', tech: '', description: '' },
  certifications: { name: '', issuer: '', year: '', link: '' },
};
const FIELDS = {
  experience: [['title', 'Role / title'], ['organization', 'Organisation'], ['start', 'Start (e.g. Jun 2025)'], ['end', 'End (or Present)']],
  projects: [['name', 'Project name'], ['tech', 'Tech / tools used'], ['link', 'Link (https://…)']],
  certifications: [['name', 'Certification'], ['issuer', 'Issuer'], ['year', 'Year'], ['link', 'Credential link']],
};
const TITLES = { experience: 'Experience & internships', projects: 'Projects', certifications: 'Certifications' };

/** ATS-friendly single-column resume: structured editor + live preview + print to PDF. */
export function ResumeBuilder() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['resume'], queryFn: studentApi.resume });
  const [resume, setResume] = useState(null);
  useEffect(() => {
    if (data && !resume) {
      const r = data.data.user.resume || {};
      setResume({ summary: r.summary || '', experience: r.experience || [], projects: r.projects || [], certifications: r.certifications || [], achievements: r.achievements || [] });
    }
  }, [data, resume]);

  const save = useMutation({
    mutationFn: () =>
      studentApi.saveResume({
        ...resume,
        achievements: resume.achievements.map((a) => a.trim()).filter(Boolean),
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.setQueryData(['resume'], res);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading || (!resume && !error)) return <CardSkeleton lines={8} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const u = data.data.user;

  const update = (section, i, key, value) => setResume((r) => ({ ...r, [section]: r[section].map((item, idx) => (idx === i ? { ...item, [key]: value } : item)) }));
  const add = (section) => setResume((r) => ({ ...r, [section]: [...r[section], { ...EMPTY[section] }] }));
  const remove = (section, i) => setResume((r) => ({ ...r, [section]: r[section].filter((_, idx) => idx !== i) }));

  const contact = [u.email, u.phone, [u.address?.city, u.address?.state].filter(Boolean).join(', ')].filter(Boolean);
  const links = [u.links?.linkedin, u.links?.github, u.links?.portfolio].filter(Boolean);

  return (
    <div className="grid-2 resume-print-root" style={{ alignItems: 'start' }}>
      <div className="stack resume-editor no-print">
        <Alert type="info">
          Your name, contact, education, skills and links come from the Profile tab. Keep it to one page and quantify impact (“reduced load time by 40%”).
        </Alert>
        <section className="card stack">
          <TextAreaField label="Professional summary" rows={3} maxLength={1200} value={resume.summary} onChange={(e) => setResume({ ...resume, summary: e.target.value })} placeholder="2–3 lines: who you are, what you're good at, what role you want." />
        </section>
        {Object.keys(EMPTY).map((section) => (
          <section key={section} className="card stack">
            <div className="row-between">
              <h3 style={{ margin: 0 }}>{TITLES[section]}</h3>
              <Button size="sm" icon={Plus} onClick={() => add(section)} disabled={resume[section].length >= 10}>Add</Button>
            </div>
            {resume[section].length === 0 && <p className="small muted mb-0">Nothing added yet.</p>}
            {resume[section].map((item, i) => (
              <div key={i} className="stack" style={{ '--gap': '10px', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <div className="row-between">
                  <span className="xs bold subtle">#{i + 1}</span>
                  <IconButton icon={Trash2} label={`Remove ${TITLES[section]} item ${i + 1}`} onClick={() => remove(section, i)} />
                </div>
                <div className="form-grid">
                  {FIELDS[section].map(([key, label]) => (
                    <TextField key={key} label={label} value={item[key] || ''} onChange={(e) => update(section, i, key, e.target.value)} maxLength={key === 'link' ? 300 : 160} />
                  ))}
                </div>
                {'description' in EMPTY[section] && (
                  <TextAreaField label="Description" rows={3} maxLength={1000} value={item.description || ''} onChange={(e) => update(section, i, 'description', e.target.value)} hint="One point per line" />
                )}
              </div>
            ))}
          </section>
        ))}
        <section className="card">
          <TextAreaField label="Achievements" hint="One per line" rows={4} maxLength={2000} value={resume.achievements.join('\n')} onChange={(e) => setResume({ ...resume, achievements: e.target.value.split('\n').slice(0, 15) })} />
        </section>
        <div className="row" style={{ position: 'sticky', bottom: 16 }}>
          <Button variant="primary" icon={Save} loading={save.isPending} onClick={() => save.mutate()} style={{ boxShadow: 'var(--shadow-lg)' }}>Save resume</Button>
          <Button icon={Printer} onClick={() => window.print()} style={{ boxShadow: 'var(--shadow-lg)' }}>Print / Save as PDF</Button>
        </div>
      </div>

      <div style={{ position: 'sticky', top: 'calc(var(--header-h) + 16px)' }}>
        <p className="xs subtle no-print">Live preview</p>
        <article className="resume-paper" aria-label="Resume preview">
          <h1>{u.name}</h1>
          {u.headline && <div style={{ fontWeight: 600, color: '#333' }}>{u.headline}</div>}
          <div className="r-contact">{contact.join(' · ')}</div>
          {links.length > 0 && <div className="r-contact">{links.map((l) => l.replace(/^https?:\/\/(www\.)?/, '')).join(' · ')}</div>}
          {resume.summary && (
            <>
              <h2>Summary</h2>
              <p style={{ margin: 0 }}>{resume.summary}</p>
            </>
          )}
          <h2>Education</h2>
          <div className="r-item">
            <div className="r-row">
              <span>{[u.education?.degree, u.education?.branch].filter(Boolean).join(', ')}</span>
              <span>{u.education?.graduationYear ? `Expected ${u.education.graduationYear}` : ''}</span>
            </div>
            <div>{u.education?.college}{u.education?.cgpa ? ` · CGPA ${u.education.cgpa}` : ''}</div>
          </div>
          {u.skills?.length > 0 && (
            <>
              <h2>Skills</h2>
              <p style={{ margin: 0 }}>{u.skills.join(' · ')}</p>
            </>
          )}
          {resume.experience.filter((e) => e.title).length > 0 && (
            <>
              <h2>Experience</h2>
              {resume.experience.filter((e) => e.title).map((e, i) => (
                <div key={i} className="r-item">
                  <div className="r-row">
                    <span>{e.title}{e.organization ? ` — ${e.organization}` : ''}</span>
                    <span style={{ fontWeight: 400 }}>{[e.start, e.end].filter(Boolean).join(' – ')}</span>
                  </div>
                  {e.description && <ul>{e.description.split('\n').filter(Boolean).map((l, j) => <li key={j}>{l.replace(/^[-•]\s*/, '')}</li>)}</ul>}
                </div>
              ))}
            </>
          )}
          {resume.projects.filter((p) => p.name).length > 0 && (
            <>
              <h2>Projects</h2>
              {resume.projects.filter((p) => p.name).map((p, i) => (
                <div key={i} className="r-item">
                  <div className="r-row">
                    <span>{p.name}{p.tech ? <span style={{ fontWeight: 400 }}> · {p.tech}</span> : null}</span>
                    {p.link && <a href={p.link} style={{ fontWeight: 400 }}>{p.link.replace(/^https?:\/\/(www\.)?/, '')}</a>}
                  </div>
                  {p.description && <ul>{p.description.split('\n').filter(Boolean).map((l, j) => <li key={j}>{l.replace(/^[-•]\s*/, '')}</li>)}</ul>}
                </div>
              ))}
            </>
          )}
          {resume.certifications.filter((c) => c.name).length > 0 && (
            <>
              <h2>Certifications</h2>
              <ul>
                {resume.certifications.filter((c) => c.name).map((c, i) => (
                  <li key={i}>{c.name}{c.issuer ? ` — ${c.issuer}` : ''}{c.year ? ` (${c.year})` : ''}</li>
                ))}
              </ul>
            </>
          )}
          {resume.achievements.filter((a) => a.trim()).length > 0 && (
            <>
              <h2>Achievements</h2>
              <ul>{resume.achievements.filter((a) => a.trim()).map((a, i) => <li key={i}>{a}</li>)}</ul>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
