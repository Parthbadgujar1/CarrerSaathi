import { useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff, X } from 'lucide-react';

function FieldShell({ id, label, required, hint, error, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span className="field-error" id={`${id}-error`} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </span>
      ) : (
        hint && (
          <span className="hint" id={`${id}-hint`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function TextField({ label, hint, error, required, className, id: idProp, icon: Icon, ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  const input = (
    <input
      id={id}
      className="input"
      required={required}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy(id, error, hint)}
      {...rest}
    />
  );
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      {Icon ? (
        <div className="input-icon">
          <Icon aria-hidden="true" />
          {input}
        </div>
      ) : (
        input
      )}
    </FieldShell>
  );
}

export function PasswordField({ label = 'Password', hint, error, required, className, ...rest }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <div className="input-group">
        <input
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...rest}
        />
        <button
          type="button"
          className="icon-btn input-addon"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, required, options = [], placeholder, className, ...rest }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <select id={id} className="select" required={required} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy(id, error, hint)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, required, className, maxLength, value, ...rest }) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      hint={maxLength ? `${hint ? `${hint} · ` : ''}${String(value ?? '').length}/${maxLength}` : hint}
      error={error}
      className={className}
    >
      <textarea
        id={id}
        className="textarea"
        required={required}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
    </FieldShell>
  );
}

export function Checkbox({ label, error, className = '', ...rest }) {
  const id = useId();
  return (
    <div className={className}>
      <label className="checkbox" htmlFor={id}>
        <input id={id} type="checkbox" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : undefined} {...rest} />
        <span>{label}</span>
      </label>
      {error && (
        <span className="field-error mt-1" id={`${id}-error`} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

export function Switch({ label, description, checked, onChange, disabled }) {
  const id = useId();
  return (
    <label className="row-between" htmlFor={id} style={{ cursor: disabled ? 'not-allowed' : 'pointer', alignItems: 'flex-start' }}>
      <span className="flex-1">
        <span className="bold">{label}</span>
        {description && <span className="small muted" style={{ display: 'block' }}>{description}</span>}
      </span>
      <span className="switch">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
        <span className="track" aria-hidden="true" />
      </span>
    </label>
  );
}

/** Tag input: Enter or comma adds a chip; Backspace on empty removes the last one. */
export function ChipsField({ label, hint, error, value = [], onChange, placeholder = 'Type and press Enter', max = 20, suggestions = [] }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const v = raw.trim().replace(/,$/, '');
    if (!v || value.includes(v) || value.length >= max) return;
    onChange([...value, v.slice(0, 60)]);
    setDraft('');
  };
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="chip-input">
        {value.map((chip) => (
          <span key={chip} className="badge badge-primary">
            {chip}
            <button type="button" className="linklike" aria-label={`Remove ${chip}`} onClick={() => onChange(value.filter((c) => c !== chip))}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          list={suggestions.length ? `${id}-list` : undefined}
          placeholder={value.length >= max ? `Maximum ${max}` : placeholder}
          disabled={value.length >= max}
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
        />
        {suggestions.length > 0 && (
          <datalist id={`${id}-list`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
    </FieldShell>
  );
}
