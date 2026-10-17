import { forwardRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * Button with variants and a built-in loading state.
 * Renders a <Link> when `to` is given, an <a> when `href` is given.
 */
export const Button = forwardRef(function Button(
  { variant = 'default', size, block, loading, icon: Icon, iconRight: IconRight, to, href, children, className = '', disabled, type = 'button', ...rest },
  ref,
) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight aria-hidden="true" />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export function IconButton({ icon: Icon, label, badge, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon aria-hidden="true" />
      {badge ? <span className="dot">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  );
}
