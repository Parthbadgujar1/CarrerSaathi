import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MailPlus } from 'lucide-react';
import { adminApi } from '../../services/api';
import { getErrorMessage, getFieldErrors } from '../../lib/http';
import { Alert, Button, ChipsField, CopyButton, Modal, SelectField, TextAreaField, TextField } from '../ui';
import { DEGREES, GRAD_YEARS } from '../../pages/auth/Register';

/** Shows a one-time activation link after inviting someone (works without SMTP too). */
export function InviteResult({ result, onClose }) {
  return (
    <Modal open onClose={onClose} title="Invitation created" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="stack">
        <Alert type="success">{result.message}</Alert>
        <p className="small mb-0">
          {result.emailDelivery === 'smtp'
            ? 'They will receive an email with this link. You can also share it directly:'
            : 'Email delivery is not configured on this server (development mode), so share this one-time activation link directly:'}
        </p>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <code className="flex-1 truncate" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>{result.inviteLink}</code>
          <CopyButton text={result.inviteLink} label="Copy link" />
        </div>
        <p className="xs muted mb-0">The link works once and expires in 72 hours.</p>
      </div>
    </Modal>
  );
}

const set = (obj, path, value) => {
  const next = structuredClone(obj);
  const keys = path.split('.');
  let cur = next;
  keys.slice(0, -1).forEach((k) => (cur = cur[k] ??= {}));
  cur[keys.at(-1)] = value;
  return next;
};

/** Edit a student's or mentor's details (admin). */
export function EditUserModal({ user, onClose, onSaved }) {
  const isMentor = user.role === 'mentor';
  const isStudent = user.role === 'student';
  const [form, setForm] = useState({
    name: user.name || '',
    phone: user.phone || '',
    headline: user.headline || '',
    bio: user.bio || '',
    education: { degree: user.education?.degree || '', branch: user.education?.branch || '', college: user.education?.college || '', university: user.education?.university || '', graduationYear: user.education?.graduationYear ? String(user.education.graduationYear) : '', currentYear: user.education?.currentYear ? String(user.education.currentYear) : '' },
    address: { city: user.address?.city || '', state: user.address?.state || '' },
    mentorProfile: { designation: user.mentorProfile?.designation || '', company: user.mentorProfile?.company || '', experienceYears: user.mentorProfile?.experienceYears ?? 0, maxMentees: user.mentorProfile?.maxMentees ?? 25, availability: user.mentorProfile?.availability || '', expertise: user.mentorProfile?.expertise || [] },
  });
  const [errors, setErrors] = useState({});
  const b = (path) => ({ value: path.split('.').reduce((o, k) => o?.[k], form) ?? '', onChange: (e) => setForm((f) => set(f, path, e.target.value)), error: errors[path] });

  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name, phone: form.phone, headline: form.headline, bio: form.bio };
      if (isStudent) {
        body.education = { ...form.education, graduationYear: Number(form.education.graduationYear) || undefined, currentYear: Number(form.education.currentYear) || undefined };
        body.address = form.address;
      }
      if (isMentor) body.mentorProfile = { ...form.mentorProfile, experienceYears: Number(form.mentorProfile.experienceYears) || 0, maxMentees: Number(form.mentorProfile.maxMentees) || 25 };
      return adminApi.updateUser(user._id, body);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });

  return (
    <Modal open size="lg" onClose={onClose} title={`Edit ${user.name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></>}>
      <div className="stack">
        <div className="form-grid">
          <TextField label="Full name" required maxLength={80} {...b('name')} data-autofocus />
          <TextField label="Email" value={user.email} disabled hint="Email cannot be changed here" />
          <TextField label="Phone" type="tel" maxLength={20} {...b('phone')} />
          <TextField label="Headline" maxLength={140} {...b('headline')} />
        </div>
        {isStudent && (
          <div className="form-grid">
            <SelectField label="Degree" placeholder="Select" options={DEGREES} {...b('education.degree')} />
            <TextField label="Branch" maxLength={80} {...b('education.branch')} />
            <TextField label="College" maxLength={160} {...b('education.college')} />
            <TextField label="University" maxLength={160} {...b('education.university')} />
            <SelectField label="Graduation year" placeholder="Select" options={GRAD_YEARS} {...b('education.graduationYear')} />
            <SelectField label="Current year" placeholder="Select" options={['1', '2', '3', '4', '5']} {...b('education.currentYear')} />
            <TextField label="City" maxLength={80} {...b('address.city')} />
            <TextField label="State" maxLength={80} {...b('address.state')} />
          </div>
        )}
        {isMentor && (
          <>
            <div className="form-grid">
              <TextField label="Designation" maxLength={100} {...b('mentorProfile.designation')} />
              <TextField label="Company" maxLength={120} {...b('mentorProfile.company')} />
              <TextField label="Years of experience" type="number" min={0} max={60} {...b('mentorProfile.experienceYears')} />
              <TextField label="Max mentees" type="number" min={1} max={200} {...b('mentorProfile.maxMentees')} />
            </div>
            <ChipsField label="Expertise" value={form.mentorProfile.expertise} onChange={(v) => setForm((f) => set(f, 'mentorProfile.expertise', v))} max={10} />
            <TextField label="Availability" maxLength={200} {...b('mentorProfile.availability')} />
          </>
        )}
        <TextAreaField label="Bio" rows={3} maxLength={1000} {...b('bio')} />
      </div>
    </Modal>
  );
}

/** Admin adds a student record; the student activates the account with a one-time link. */
export function AddStudentModal({ onClose, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', education: { degree: '', branch: '', college: '', graduationYear: '' } });
  const [errors, setErrors] = useState({});
  const b = (path) => ({ value: path.split('.').reduce((o, k) => o?.[k], form) ?? '', onChange: (e) => setForm((f) => set(f, path, e.target.value)), error: errors[path] });
  const save = useMutation({
    mutationFn: () => adminApi.createStudent({ ...form, education: { ...form.education, graduationYear: Number(form.education.graduationYear) || undefined } }),
    onSuccess: (res) => onDone({ ...res.data, message: res.message }),
    onError: (err) => {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    },
  });
  return (
    <Modal open size="lg" onClose={onClose} title="Add a student" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={MailPlus} loading={save.isPending} onClick={() => save.mutate()}>Create & send invite</Button></>}>
      <div className="stack">
        <p className="small muted mb-0">The student receives a secure link to set their own password. Use this for walk-in registrations or imported records.</p>
        <div className="form-grid">
          <TextField label="Full name" required maxLength={80} {...b('name')} data-autofocus />
          <TextField label="Email" type="email" required maxLength={160} {...b('email')} />
          <TextField label="Phone" type="tel" maxLength={20} {...b('phone')} />
          <SelectField label="Degree" required placeholder="Select" options={DEGREES} {...b('education.degree')} />
          <TextField label="Branch" maxLength={80} {...b('education.branch')} />
          <TextField label="College" required maxLength={160} {...b('education.college')} />
          <SelectField label="Graduation year" required placeholder="Select" options={GRAD_YEARS} {...b('education.graduationYear')} />
        </div>
      </div>
    </Modal>
  );
}
