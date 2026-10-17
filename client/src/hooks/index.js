import { useCallback, useEffect, useRef, useState } from 'react';
import { SITE } from '../config/site';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;
  }, [title]);
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const listener = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler(e);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, active]);
}

export function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setY(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return y;
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps keyboard focus inside a dialog, closes on Escape and restores focus on close. */
export function useFocusTrap(active, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE);
    first?.focus();
    const onKey = (e) => {
      // With stacked dialogs (e.g. a confirm inside a drawer) only the top-most one reacts.
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      if (node && dialogs.length && dialogs[dialogs.length - 1] !== node) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [active, onClose]);
  return ref;
}

/** Simple controlled form state with field errors. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = useCallback((name, value) => {
    setValues((v) => {
      const next = structuredClone(v);
      const parts = name.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i += 1) cur = cur[parts[i]] ??= {};
      cur[parts.at(-1)] = value;
      return next;
    });
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);
  const bind = useCallback(
    (name, { type } = {}) => {
      const value = name.split('.').reduce((o, k) => o?.[k], values);
      if (type === 'checkbox') return { name, checked: Boolean(value), onChange: (e) => set(name, e.target.checked) };
      return { name, value: value ?? '', onChange: (e) => set(name, e.target.value), error: errors[name] };
    },
    [values, errors, set],
  );
  return { values, setValues, set, errors, setErrors, bind };
}
