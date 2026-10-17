import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { roadmapApi, userApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { Alert, Button, ChipsField, SelectField, TextAreaField, TextField } from '../ui';
import { DEGREES, GRAD_YEARS } from '../../pages/auth/Register';

const INDIAN_STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

const pickProfile = (u) => ({
  name: u.name || '',
  phone: u.phone || '',
  headline: u.headline || '',
  bio: u.bio || '',
  education: {
    degree: u.education?.degree || '',
    branch: u.education?.branch || '',
    college: u.education?.college || '',
    university: u.education?.university || '',
    graduationYear: u.education?.graduationYear ? String(u.education.graduationYear) : '',
    currentYear: u.education?.currentYear ? String(u.education.currentYear) : '',
    cgpa: u.education?.cgpa ?? '',
  },
  address: { line1: u.address?.line1 || '', city: u.address?.city || '', state: u.address?.state || '', pincode: u.address?.pincode || '' },
  careerTracks: u.careerTracks || [],
  skills: u.skills || [],
  interests: u.interests || [],
  links: { linkedin: u.links?.linkedin || '', github: u.links?.github || '', portfolio: u.links?.portfolio || '', codingProfile: u.links?.codingProfile || '', resumeUrl: u.links?.resumeUrl || '' },
  mentorProfile: {
    designation: u.mentorProfile?.designation || '',
    company: u.mentorProfile?.company || '',
    expertise: u.mentorProfile?.expertise || [],
    experienceYears: u.mentorProfile?.experienceYears ?? 0,
    maxMentees: u.mentorProfile?.maxMentees ?? 25,
    availability: u.mentorProfile?.availability || '',
  },
});

/** Profile editor for every role (sections shown depend on role). */
export function ProfileForm() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [form, setForm] = useState(() => pickProfile(user));
  const [errors, setErrors] = useState({});
  const { data: roadmaps } = useQuery({ queryKey: ['roadmaps', 'list', '', ''], queryFn: () => roadmapApi.list(), enabled: user.role === 'student' });
  const isStudent = user.role === 'student';
  const isMentor = user.role === 'mentor';

  const set = (path, value) =>
    setForm((f) => {
      const next = structuredClone(f);
      const keys = path.split('.');
      let cur = next;
      keys.slice(0, -1).forEach((k) => (cur = cur[k]));
      cur[keys.at(-1)] = value;
      return next;
    });
  const bind = (path) => ({ value: path.split('.').reduce((o, k) => o?.[k], form) ?? '', onChange: (e) => set(path, e.target.value), error: errors[path] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        phone: form.phone,
        headline: form.headline,
        bio: form.bio,
        links: form.links,
      };
      if (isStudent) {
        Object.assign(body, {
          education: {
            ...form.education,
            graduationYear: form.education.graduationYear ? Number(form.education.graduationYear) : undefined,
            currentYear: form.education.currentYear ? Number(form.education.currentYear) : undefined,
            cgpa: form.education.cgpa === '' ? undefined : Number(form.education.cgpa),
          },
          address: form.address,
          careerTracks: form.careerTracks,
          skills: form.skills,
          interests: form.interests,
        });
      }
      if (isMentor) body.mentorProfile = { ...form.mentorProfile, experienceYears: Number(form.mentorProfile.experienceYears) || 0, maxMentees: Number(form.mentorProfile.maxMentees) || 25 };
      return userApi.updateProfile(body);
    },
    onSuccess: (res) => {
      setUser(res.data.user);
      setErrors({});
      toast.success(res.message);
    },
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });

  const trackOptions = (roadmaps?.data || []).map((r) => ({ value: r.slug, label: r.title }));
  const titleBySlug = Object.fromEntries(trackOptions.map((t) => [t.value, t.label]));

  return (
    <form
      className="stack"
      style={{ '--gap': '20px', maxWidth: 1000 }}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      noValidate
    >
      {Object.keys(errors).length > 0 && <Alert type="error">Please fix the highlighted fields.</Alert>}
      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Basic details</h2>
        <div className="form-grid">
          <TextField label="Full name" required maxLength={80} {...bind('name')} />
          <TextField label="Email" value={user.email} disabled hint="Contact support to change your email" />
          <TextField label="Phone" type="tel" maxLength={20} {...bind('phone')} />
          <TextField label="Headline" maxLength={140} placeholder={isMentor ? 'Senior Engineer at …' : 'Aspiring data analyst | SQL | Power BI'} {...bind('headline')} />
        </div>
        <TextAreaField label="About" rows={3} maxLength={1000} {...bind('bio')} />
      </section>

      {isMentor && (
        <section className="card stack">
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Mentor profile</h2>
          <div className="form-grid">
            <TextField label="Designation" maxLength={100} {...bind('mentorProfile.designation')} />
            <TextField label="Company" maxLength={120} {...bind('mentorProfile.company')} />
            <TextField label="Years of experience" type="number" min={0} max={60} {...bind('mentorProfile.experienceYears')} />
            <TextField label="Max mentees" type="number" min={1} max={200} hint="We'll hide you from the directory when full" {...bind('mentorProfile.maxMentees')} />
          </div>
          <ChipsField label="Expertise" value={form.mentorProfile.expertise} onChange={(v) => set('mentorProfile.expertise', v)} max={10} />
          <TextField label="Availability" maxLength={200} {...bind('mentorProfile.availability')} />
        </section>
      )}

      {isStudent && (
        <>
          <section className="card stack">
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Education</h2>
            <div className="form-grid">
              <SelectField label="Degree" placeholder="Select" options={DEGREES} {...bind('education.degree')} />
              <TextField label="Branch / specialisation" maxLength={80} {...bind('education.branch')} />
              <TextField label="College" maxLength={160} {...bind('education.college')} />
              <TextField label="University" maxLength={160} {...bind('education.university')} />
              <SelectField label="Graduation year" placeholder="Select" options={GRAD_YEARS} {...bind('education.graduationYear')} />
              <SelectField label="Current year" placeholder="Select" options={['1', '2', '3', '4', '5']} {...bind('education.currentYear')} />
              <TextField label="CGPA (out of 10)" type="number" min={0} max={10} step="0.01" {...bind('education.cgpa')} />
            </div>
          </section>
          <section className="card stack">
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Career interests & skills</h2>
            <div className="field">
              <span className="label">Career tracks</span>
              <div className="chips">
                {form.careerTracks.map((t) => (
                  <span key={t} className="badge badge-primary">
                    {titleBySlug[t] || t}
                    <button type="button" className="linklike" aria-label={`Remove ${titleBySlug[t] || t}`} onClick={() => set('careerTracks', form.careerTracks.filter((x) => x !== t))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {form.careerTracks.length < 5 && (
                <select className="select" aria-label="Add a career track" value="" onChange={(e) => e.target.value && set('careerTracks', [...form.careerTracks, e.target.value])}>
                  <option value="">+ Add a career track</option>
                  {trackOptions.filter((t) => !form.careerTracks.includes(t.value)).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              )}
              <span className="hint">Used to match opportunities, sessions and communities. Up to 5.</span>
            </div>
            <ChipsField label="Skills" hint="Compared against roadmap skills in the skill-gap analysis" value={form.skills} onChange={(v) => set('skills', v)} max={40} />
            <ChipsField label="Interests" value={form.interests} onChange={(v) => set('interests', v)} max={20} />
          </section>
          <section className="card stack">
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Address</h2>
            <p className="xs muted mb-0">Optional. Visible only to programme admins for records.</p>
            <TextField label="Address line" maxLength={200} {...bind('address.line1')} />
            <div className="form-grid">
              <TextField label="City" maxLength={80} {...bind('address.city')} />
              <SelectField label="State / UT" placeholder="Select" options={INDIAN_STATES} {...bind('address.state')} />
              <TextField label="PIN code" inputMode="numeric" maxLength={6} {...bind('address.pincode')} />
            </div>
          </section>
        </>
      )}

      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Professional links</h2>
        <div className="form-grid">
          <TextField label="LinkedIn" type="url" placeholder="https://www.linkedin.com/in/…" maxLength={300} {...bind('links.linkedin')} />
          {!isMentor && <TextField label="GitHub" type="url" placeholder="https://github.com/…" maxLength={300} {...bind('links.github')} />}
          <TextField label="Portfolio / website" type="url" maxLength={300} {...bind('links.portfolio')} />
          {isStudent && <TextField label="Coding profile" type="url" placeholder="LeetCode / HackerRank" maxLength={300} {...bind('links.codingProfile')} />}
          {isStudent && <TextField label="Resume link (optional)" type="url" placeholder="Google Drive / Dropbox link" maxLength={300} {...bind('links.resumeUrl')} />}
        </div>
      </section>
      <div className="row" style={{ position: 'sticky', bottom: 16, justifyContent: 'flex-end' }}>
        <Button type="submit" variant="primary" icon={Save} loading={save.isPending} style={{ boxShadow: 'var(--shadow-lg)' }}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
